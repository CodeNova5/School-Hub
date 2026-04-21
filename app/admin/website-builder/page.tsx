"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Plus, Save, Globe2, Pencil, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useSchoolContext } from "@/hooks/use-school-context";

type WebsiteTemplate = "classic" | "sunrise" | "minimal";
type PageStatus = "draft" | "published" | "archived";

type PageSection = {
  id?: string;
  type?: string;
  title?: string;
  body?: string;
  ctaLabel?: string;
  ctaHref?: string;
  isVisible?: boolean;
};

type WebsiteSettings = {
  template_key: WebsiteTemplate;
  brand_name: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  heading_font: string;
  body_font: string;
  hero_title: string;
  hero_subtitle: string;
  cta_label: string;
  cta_href: string;
  show_news: boolean;
  show_events: boolean;
};

type WebsitePage = {
  id: string;
  title: string;
  slug: string;
  status: PageStatus;
  is_homepage: boolean;
  sections: PageSection[];
  updated_at: string;
};

const defaultSettings: WebsiteSettings = {
  template_key: "classic",
  brand_name: "",
  primary_color: "#0f766e",
  secondary_color: "#f8fafc",
  accent_color: "#ea580c",
  heading_font: "Poppins",
  body_font: "Open Sans",
  hero_title: "Welcome to our school",
  hero_subtitle: "A vibrant learning community where students thrive.",
  cta_label: "Explore",
  cta_href: "/news",
  show_news: true,
  show_events: true,
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function parseSections(text: string): PageSection[] {
  if (!text.trim()) {
    return [];
  }

  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) {
    throw new Error("Sections must be a JSON array.");
  }

  return parsed;
}

export default function AdminWebsiteBuilderPage() {
  const { schoolId, isLoading: schoolLoading } = useSchoolContext();

  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingPage, setSavingPage] = useState(false);

  const [settings, setSettings] = useState<WebsiteSettings>(defaultSettings);
  const [pages, setPages] = useState<WebsitePage[]>([]);
  const [publicSiteUrl, setPublicSiteUrl] = useState<string>("");

  const [newTitle, setNewTitle] = useState("");
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [selectedPageTitle, setSelectedPageTitle] = useState("");
  const [selectedPageSlug, setSelectedPageSlug] = useState("");
  const [selectedPageStatus, setSelectedPageStatus] = useState<PageStatus>("draft");
  const [selectedPageIsHomepage, setSelectedPageIsHomepage] = useState(false);
  const [selectedPageSections, setSelectedPageSections] = useState<string>("[]");

  const selectedPage = useMemo(
    () => pages.find((item) => item.id === selectedPageId) || null,
    [pages, selectedPageId]
  );

  useEffect(() => {
    if (!schoolLoading && schoolId) {
      loadWebsiteBuilderData();
    }
  }, [schoolId, schoolLoading]);

  useEffect(() => {
    if (!selectedPage) {
      return;
    }

    setSelectedPageTitle(selectedPage.title);
    setSelectedPageSlug(selectedPage.slug);
    setSelectedPageStatus(selectedPage.status);
    setSelectedPageIsHomepage(selectedPage.is_homepage);
    setSelectedPageSections(JSON.stringify(selectedPage.sections ?? [], null, 2));
  }, [selectedPage?.id]);

  async function loadWebsiteBuilderData() {
    if (!schoolId) {
      return;
    }

    try {
      setLoading(true);

      const [
        { data: settingsData, error: settingsError },
        { data: pagesData, error: pagesError },
        { data: schoolData, error: schoolError },
      ] =
        await Promise.all([
          supabase
            .from("website_site_settings")
            .select("template_key, brand_name, primary_color, secondary_color, accent_color, heading_font, body_font, hero_title, hero_subtitle, cta_label, cta_href, show_news, show_events")
            .eq("school_id", schoolId)
            .maybeSingle(),
          supabase
            .from("website_pages")
            .select("id, title, slug, status, is_homepage, sections, updated_at")
            .eq("school_id", schoolId)
            .order("updated_at", { ascending: false }),
          supabase
            .from("schools")
            .select("subdomain")
            .eq("id", schoolId)
            .maybeSingle(),
        ]);

      if (settingsError && settingsError.code !== "PGRST116") {
        throw settingsError;
      }

      if (pagesError) {
        throw pagesError;
      }

      if (schoolError && schoolError.code !== "PGRST116") {
        throw schoolError;
      }

      setSettings({
        ...defaultSettings,
        ...(settingsData || {}),
      });

      const mappedPages = (pagesData || []).map((page: { sections: any; }) => ({
        ...page,
        sections: Array.isArray(page.sections) ? page.sections : [],
      })) as WebsitePage[];

      setPages(mappedPages);

      const appMainDomain = (process.env.NEXT_PUBLIC_MAIN_DOMAIN || "schooldeck.tech")
        .replace(/^https?:\/\//, "")
        .replace(/\/$/, "");
      if (schoolData?.subdomain) {
        setPublicSiteUrl(`https://${schoolData.subdomain}.${appMainDomain}`);
      } else {
        setPublicSiteUrl("");
      }

      if (mappedPages.length > 0) {
        setSelectedPageId((current) => current || mappedPages[0].id);
      }
    } catch (error: any) {
      console.error("Failed to load website builder data:", error);
      toast.error(error.message || "Failed to load website builder data");
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings() {
    if (!schoolId) {
      return;
    }

    try {
      setSavingSettings(true);

      const payload = {
        school_id: schoolId,
        ...settings,
      };

      const { error } = await supabase
        .from("website_site_settings")
        .upsert(payload, { onConflict: "school_id" });

      if (error) {
        throw error;
      }

      toast.success("Website settings saved");
    } catch (error: any) {
      console.error("Failed to save website settings:", error);
      toast.error(error.message || "Failed to save settings");
    } finally {
      setSavingSettings(false);
    }
  }

  async function createPage() {
    if (!schoolId) {
      return;
    }

    const title = newTitle.trim();
    if (!title) {
      toast.error("Enter a page title first.");
      return;
    }

    try {
      setSavingPage(true);

      const slug = slugify(title);
      if (!slug) {
        toast.error("Page title is invalid for a URL slug.");
        return;
      }

      const { data, error } = await supabase
        .from("website_pages")
        .insert({
          school_id: schoolId,
          title,
          slug,
          status: "draft",
          sections: [
            {
              type: "text",
              title: "About this page",
              body: "Update this section from Website Builder.",
              isVisible: true,
            },
          ],
          is_homepage: pages.length === 0,
        })
        .select("id, title, slug, status, is_homepage, sections, updated_at")
        .single();

      if (error) {
        throw error;
      }

      toast.success("Page created");
      setNewTitle("");

      const createdPage = {
        ...data,
        sections: Array.isArray(data.sections) ? data.sections : [],
      } as WebsitePage;

      setPages((prev) => [createdPage, ...prev]);
      setSelectedPageId(createdPage.id);
    } catch (error: any) {
      console.error("Failed to create page:", error);
      toast.error(error.message || "Failed to create page");
    } finally {
      setSavingPage(false);
    }
  }

  async function saveSelectedPage() {
    if (!selectedPageId || !schoolId) {
      return;
    }

    try {
      setSavingPage(true);

      const sections = parseSections(selectedPageSections);
      const slug = slugify(selectedPageSlug || selectedPageTitle);

      if (!selectedPageTitle.trim() || !slug) {
        toast.error("Page title and slug are required.");
        return;
      }

      const payload = {
        title: selectedPageTitle.trim(),
        slug,
        status: selectedPageStatus,
        is_homepage: selectedPageIsHomepage,
        sections,
        published_at: selectedPageStatus === "published" ? new Date().toISOString() : null,
      };

      const { data, error } = await supabase
        .from("website_pages")
        .update(payload)
        .eq("id", selectedPageId)
        .eq("school_id", schoolId)
        .select("id, title, slug, status, is_homepage, sections, updated_at")
        .single();

      if (error) {
        throw error;
      }

      const updatedPage = {
        ...data,
        sections: Array.isArray(data.sections) ? data.sections : [],
      } as WebsitePage;

      setPages((prev) => prev.map((item) => (item.id === updatedPage.id ? updatedPage : item)));
      toast.success("Page saved");
    } catch (error: any) {
      console.error("Failed to save page:", error);
      toast.error(error.message || "Failed to save page");
    } finally {
      setSavingPage(false);
    }
  }

  if (loading || schoolLoading) {
    return (
      <DashboardLayout role="admin">
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Website Builder</h1>
            <p className="mt-1 text-sm text-slate-600">
              Build and publish your school website on its subdomain.
            </p>
          </div>
          <a
            href={publicSiteUrl || "#"}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            target="_blank"
            rel="noreferrer"
          >
            <Globe2 className="h-4 w-4" />
            {publicSiteUrl ? "Open Public Site" : "Set School Subdomain First"}
          </a>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Brand and Template</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Template</Label>
                <Select
                  value={settings.template_key}
                  onValueChange={(value: WebsiteTemplate) =>
                    setSettings((prev) => ({ ...prev, template_key: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select template" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="classic">Classic Academy</SelectItem>
                    <SelectItem value="sunrise">Sunrise Campus</SelectItem>
                    <SelectItem value="minimal">Minimal Slate</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Brand Name</Label>
                <Input
                  value={settings.brand_name}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, brand_name: e.target.value }))
                  }
                  placeholder="Your School Name"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Primary Color</Label>
                <Input
                  type="color"
                  value={settings.primary_color}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, primary_color: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Secondary Color</Label>
                <Input
                  type="color"
                  value={settings.secondary_color}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, secondary_color: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Accent Color</Label>
                <Input
                  type="color"
                  value={settings.accent_color}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, accent_color: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Hero Title</Label>
                <Input
                  value={settings.hero_title}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, hero_title: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Hero Subtitle</Label>
                <Input
                  value={settings.hero_subtitle}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, hero_subtitle: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>CTA Label</Label>
                <Input
                  value={settings.cta_label}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, cta_label: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>CTA Link</Label>
                <Input
                  value={settings.cta_href}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, cta_href: e.target.value }))
                  }
                  placeholder="/news"
                />
              </div>
            </div>

            <Button onClick={saveSettings} disabled={savingSettings}>
              {savingSettings ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Website Settings
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Pages</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Create New Page</Label>
                <div className="flex gap-2">
                  <Input
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="About Us"
                  />
                  <Button onClick={createPage} disabled={savingPage}>
                    {savingPage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                {pages.length === 0 ? (
                  <p className="text-sm text-slate-500">No pages yet. Create your first page.</p>
                ) : (
                  pages.map((page) => (
                    <button
                      key={page.id}
                      type="button"
                      onClick={() => setSelectedPageId(page.id)}
                      className={`w-full rounded-lg border p-3 text-left transition ${
                        selectedPageId === page.id
                          ? "border-blue-500 bg-blue-50"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-slate-900">{page.title}</p>
                        <Badge variant="outline" className="uppercase text-[10px]">
                          {page.status}
                        </Badge>
                      </div>
                      <p className="mt-1 truncate text-xs text-slate-500">/{page.slug}</p>
                      {page.is_homepage && (
                        <p className="mt-1 text-xs font-semibold text-emerald-600">Homepage</p>
                      )}
                    </button>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Pencil className="h-4 w-4" />
                Page Editor
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selectedPage ? (
                <p className="text-sm text-slate-500">Select a page to edit.</p>
              ) : (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Title</Label>
                      <Input
                        value={selectedPageTitle}
                        onChange={(e) => {
                          setSelectedPageTitle(e.target.value);
                          if (!selectedPageSlug || selectedPageSlug === slugify(selectedPage.title)) {
                            setSelectedPageSlug(slugify(e.target.value));
                          }
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Slug</Label>
                      <Input
                        value={selectedPageSlug}
                        onChange={(e) => setSelectedPageSlug(slugify(e.target.value))}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select
                        value={selectedPageStatus}
                        onValueChange={(value: PageStatus) => setSelectedPageStatus(value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="published">Published</SelectItem>
                          <SelectItem value="archived">Archived</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Homepage</Label>
                      <Button
                        variant={selectedPageIsHomepage ? "default" : "outline"}
                        className="w-full"
                        onClick={() => setSelectedPageIsHomepage((prev) => !prev)}
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        {selectedPageIsHomepage ? "Homepage Enabled" : "Set as Homepage"}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Sections JSON</Label>
                    <Textarea
                      value={selectedPageSections}
                      onChange={(e) => setSelectedPageSections(e.target.value)}
                      className="min-h-[320px] font-mono text-xs"
                    />
                    <p className="text-xs text-slate-500">
                      Use a JSON array of section objects. Example keys: type, title, body, ctaLabel, ctaHref, isVisible.
                    </p>
                  </div>

                  <Button onClick={saveSelectedPage} disabled={savingPage}>
                    {savingPage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Page
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
