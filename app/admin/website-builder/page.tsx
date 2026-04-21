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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  Loader2,
  Plus,
  Save,
  Globe2,
  Pencil,
  CheckCircle2,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Trash2,
  Sparkles,
  Newspaper,
  CalendarDays,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useSchoolContext } from "@/hooks/use-school-context";

type WebsiteTemplate = "classic" | "sunrise" | "minimal";
type PageStatus = "draft" | "published" | "archived";

type PageSection = {
  id?: string;
  type?: SectionType;
  title?: string;
  body?: string;
  ctaLabel?: string;
  ctaHref?: string;
  imageUrl?: string;
  items?: string[];
  isVisible?: boolean;
};

type SectionType =
  | "text"
  | "feature-grid"
  | "stats"
  | "gallery"
  | "faq"
  | "cta-banner"
  | "timeline";

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
  seo_title: string;
  seo_description: string;
  seo_image_url: string;
  status: PageStatus;
  is_homepage: boolean;
  sections: PageSection[];
  updated_at: string;
};

type NewsItem = {
  id: string;
  title: string;
  content: string;
  excerpt: string;
  image_url: string;
  slug: string;
  seo_title: string;
  seo_description: string;
  published: boolean;
  published_at: string | null;
  created_at: string;
};

type EventItem = {
  id: string;
  title: string;
  description: string;
  excerpt: string;
  event_type: string;
  location: string;
  start_date: string;
  end_date: string;
  is_all_day: boolean;
  slug: string;
  seo_title: string;
  seo_description: string;
  published: boolean;
  published_at: string | null;
  created_at: string;
};

type NewsForm = Omit<NewsItem, "id" | "created_at">;
type EventForm = Omit<EventItem, "id" | "created_at">;

const SECTION_PRESETS: Array<{
  type: SectionType;
  label: string;
  title: string;
  body: string;
  items?: string[];
}> = [
  {
    type: "text",
    label: "Text",
    title: "About Our School",
    body: "Share your school story, mission, and what makes your learning community unique.",
  },
  {
    type: "feature-grid",
    label: "Feature Grid",
    title: "Why Families Choose Us",
    body: "Highlight your strongest programs and values.",
    items: [
      "Experienced Teachers",
      "Safe Learning Environment",
      "Strong Academic Results",
      "Modern Learning Facilities",
    ],
  },
  {
    type: "stats",
    label: "Stats",
    title: "Our Impact in Numbers",
    body: "Present your school's key statistics.",
    items: ["1200|Students", "95|Graduation Rate", "60|Teachers", "25|Years of Excellence"],
  },
  {
    type: "gallery",
    label: "Gallery",
    title: "Campus Highlights",
    body: "Add image URLs to showcase your school campus and activities.",
    items: ["https://images.unsplash.com/photo-1523050854058-8df90110c9f1"],
  },
  {
    type: "faq",
    label: "FAQ",
    title: "Frequently Asked Questions",
    body: "Answer common admission and academic questions.",
    items: [
      "How do I apply?|Use the Apply button to submit admissions information online.",
      "Do you offer extracurriculars?|Yes, we offer clubs, sports, and creative programs.",
    ],
  },
  {
    type: "timeline",
    label: "Timeline",
    title: "Admissions Timeline",
    body: "Show families what to expect during admissions.",
    items: [
      "Application Submitted|Within 24 hours",
      "Review and Screening|3-5 business days",
      "Interview/Assessment|Scheduled by admissions",
      "Admission Decision|Shared by email",
    ],
  },
  {
    type: "cta-banner",
    label: "CTA Banner",
    title: "Ready to Join Our School?",
    body: "Start your admissions journey today.",
    items: [],
  },
];

function nowAsLocalDateTime() {
  const date = new Date();
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
}

function makeSectionId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `sec-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeSections(raw: unknown): PageSection[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .filter((section) => section && typeof section === "object")
    .map((section) => {
      const cast = section as PageSection;
      return {
        id: cast.id || makeSectionId(),
        type: cast.type || "text",
        title: cast.title || "",
        body: cast.body || "",
        ctaLabel: cast.ctaLabel || "",
        ctaHref: cast.ctaHref || "",
        imageUrl: cast.imageUrl || "",
        items: Array.isArray(cast.items) ? cast.items : [],
        isVisible: cast.isVisible !== false,
      };
    });
}

function sectionPreset(type: SectionType): PageSection {
  const preset = SECTION_PRESETS.find((item) => item.type === type)!;
  return {
    id: makeSectionId(),
    type,
    title: preset.title,
    body: preset.body,
    ctaLabel: type === "cta-banner" ? "Apply Now" : "",
    ctaHref: type === "cta-banner" ? "/admission" : "",
    imageUrl: type === "gallery" ? "" : "",
    items: preset.items ? [...preset.items] : [],
    isVisible: true,
  };
}

function buildLandingPreset(template: WebsiteTemplate, schoolName: string): PageSection[] {
  const base = [
    sectionPreset("feature-grid"),
    sectionPreset("stats"),
    sectionPreset("timeline"),
    sectionPreset("faq"),
    sectionPreset("cta-banner"),
  ];

  if (template === "sunrise") {
    base.unshift({
      ...sectionPreset("text"),
      title: `A Bright Future at ${schoolName || "Our School"}`,
      body: "Our curriculum combines academic strength with character development and creativity.",
    });
  }

  if (template === "minimal") {
    base.unshift({
      ...sectionPreset("text"),
      title: `Focused Learning at ${schoolName || "Our School"}`,
      body: "Simple, effective, and student-centered education with measurable outcomes.",
    });
  }

  if (template === "classic") {
    base.unshift({
      ...sectionPreset("text"),
      title: `Welcome to ${schoolName || "Our School"}`,
      body: "A tradition of excellence, discipline, and leadership for future generations.",
    });
  }

  return base;
}

const emptyNewsForm: NewsForm = {
  title: "",
  content: "",
  excerpt: "",
  image_url: "",
  slug: "",
  seo_title: "",
  seo_description: "",
  published: false,
  published_at: null,
};

const emptyEventForm: EventForm = {
  title: "",
  description: "",
  excerpt: "",
  event_type: "meeting",
  location: "",
  start_date: nowAsLocalDateTime(),
  end_date: nowAsLocalDateTime(),
  is_all_day: false,
  slug: "",
  seo_title: "",
  seo_description: "",
  published: false,
  published_at: null,
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
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [eventItems, setEventItems] = useState<EventItem[]>([]);
  const [publicSiteUrl, setPublicSiteUrl] = useState<string>("");

  const [newTitle, setNewTitle] = useState("");
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [selectedPageTitle, setSelectedPageTitle] = useState("");
  const [selectedPageSlug, setSelectedPageSlug] = useState("");
  const [selectedPageSeoTitle, setSelectedPageSeoTitle] = useState("");
  const [selectedPageSeoDescription, setSelectedPageSeoDescription] = useState("");
  const [selectedPageSeoImageUrl, setSelectedPageSeoImageUrl] = useState("");
  const [selectedPageStatus, setSelectedPageStatus] = useState<PageStatus>("draft");
  const [selectedPageIsHomepage, setSelectedPageIsHomepage] = useState(false);
  const [selectedPageSections, setSelectedPageSections] = useState<PageSection[]>([]);
  const [newSectionType, setNewSectionType] = useState<SectionType>("text");

  const [editingNewsId, setEditingNewsId] = useState<string | null>(null);
  const [newsForm, setNewsForm] = useState<NewsForm>(emptyNewsForm);

  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eventForm, setEventForm] = useState<EventForm>(emptyEventForm);

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
    setSelectedPageSeoTitle(selectedPage.seo_title || "");
    setSelectedPageSeoDescription(selectedPage.seo_description || "");
    setSelectedPageSeoImageUrl(selectedPage.seo_image_url || "");
    setSelectedPageStatus(selectedPage.status);
    setSelectedPageIsHomepage(selectedPage.is_homepage);
    setSelectedPageSections(normalizeSections(selectedPage.sections));
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
        { data: newsData, error: newsError },
        { data: eventsData, error: eventsError },
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
            .select("id, title, slug, seo_title, seo_description, seo_image_url, status, is_homepage, sections, updated_at")
            .eq("school_id", schoolId)
            .order("updated_at", { ascending: false }),
          supabase
            .from("news")
            .select("id, title, content, excerpt, image_url, slug, seo_title, seo_description, published, published_at, created_at")
            .eq("school_id", schoolId)
            .order("created_at", { ascending: false }),
          supabase
            .from("events")
            .select("id, title, description, excerpt, event_type, location, start_date, end_date, is_all_day, slug, seo_title, seo_description, published, published_at, created_at")
            .eq("school_id", schoolId)
            .order("start_date", { ascending: false }),
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

      if (newsError) {
        throw newsError;
      }

      if (eventsError) {
        throw eventsError;
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
        sections: normalizeSections(page.sections),
      })) as WebsitePage[];

      setPages(mappedPages);
      setNewsItems((newsData || []) as NewsItem[]);
      setEventItems((eventsData || []) as EventItem[]);

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
          seo_title: title,
          seo_description: "",
          seo_image_url: "",
          status: "draft",
          sections: buildLandingPreset(settings.template_key, settings.brand_name),
          is_homepage: pages.length === 0,
        })
        .select("id, title, slug, seo_title, seo_description, seo_image_url, status, is_homepage, sections, updated_at")
        .single();

      if (error) {
        throw error;
      }

      toast.success("Page created");
      setNewTitle("");

      const createdPage = {
        ...data,
        sections: normalizeSections(data.sections),
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

      const slug = slugify(selectedPageSlug || selectedPageTitle);

      if (!selectedPageTitle.trim() || !slug) {
        toast.error("Page title and slug are required.");
        return;
      }

      const payload = {
        title: selectedPageTitle.trim(),
        slug,
        seo_title: selectedPageSeoTitle.trim(),
        seo_description: selectedPageSeoDescription.trim(),
        seo_image_url: selectedPageSeoImageUrl.trim(),
        status: selectedPageStatus,
        is_homepage: selectedPageIsHomepage,
        sections: selectedPageSections,
        published_at: selectedPageStatus === "published" ? new Date().toISOString() : null,
      };

      const { data, error } = await supabase
        .from("website_pages")
        .update(payload)
        .eq("id", selectedPageId)
        .eq("school_id", schoolId)
        .select("id, title, slug, seo_title, seo_description, seo_image_url, status, is_homepage, sections, updated_at")
        .single();

      if (error) {
        throw error;
      }

      const updatedPage = {
        ...data,
        sections: normalizeSections(data.sections),
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

  function updateSection(sectionId: string, patch: Partial<PageSection>) {
    setSelectedPageSections((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              ...patch,
            }
          : section
      )
    );
  }

  function updateSectionItems(sectionId: string, text: string) {
    const items = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    updateSection(sectionId, { items });
  }

  function addSection() {
    setSelectedPageSections((prev) => [...prev, sectionPreset(newSectionType)]);
  }

  function removeSection(sectionId: string) {
    setSelectedPageSections((prev) => prev.filter((section) => section.id !== sectionId));
  }

  function moveSection(sectionId: string, direction: -1 | 1) {
    setSelectedPageSections((prev) => {
      const index = prev.findIndex((section) => section.id === sectionId);
      if (index < 0) {
        return prev;
      }
      const target = index + direction;
      if (target < 0 || target >= prev.length) {
        return prev;
      }
      const next = [...prev];
      const [current] = next.splice(index, 1);
      next.splice(target, 0, current);
      return next;
    });
  }

  function applyLandingPreset() {
    setSelectedPageSections(buildLandingPreset(settings.template_key, settings.brand_name));
  }

  function resetNewsForm() {
    setEditingNewsId(null);
    setNewsForm(emptyNewsForm);
  }

  function editNews(item: NewsItem) {
    setEditingNewsId(item.id);
    setNewsForm({
      title: item.title,
      content: item.content,
      excerpt: item.excerpt,
      image_url: item.image_url,
      slug: item.slug,
      seo_title: item.seo_title,
      seo_description: item.seo_description,
      published: item.published,
      published_at: item.published_at,
    });
  }

  async function saveNews() {
    if (!schoolId) {
      return;
    }

    const title = newsForm.title.trim();
    if (!title) {
      toast.error("News title is required.");
      return;
    }

    const slug = slugify(newsForm.slug || title);
    if (!slug) {
      toast.error("Invalid slug for news.");
      return;
    }

    const payload = {
      school_id: schoolId,
      title,
      content: newsForm.content.trim(),
      excerpt: newsForm.excerpt.trim(),
      image_url: newsForm.image_url.trim(),
      slug,
      seo_title: newsForm.seo_title.trim(),
      seo_description: newsForm.seo_description.trim(),
      published: newsForm.published,
      published_at: newsForm.published ? new Date().toISOString() : null,
    };

    try {
      setSavingPage(true);

      const query = editingNewsId
        ? supabase
            .from("news")
            .update(payload)
            .eq("id", editingNewsId)
            .eq("school_id", schoolId)
            .select("id, title, content, excerpt, image_url, slug, seo_title, seo_description, published, published_at, created_at")
            .single()
        : supabase
            .from("news")
            .insert(payload)
            .select("id, title, content, excerpt, image_url, slug, seo_title, seo_description, published, published_at, created_at")
            .single();

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      const item = data as NewsItem;
      setNewsItems((prev) =>
        editingNewsId ? prev.map((entry) => (entry.id === item.id ? item : entry)) : [item, ...prev]
      );

      toast.success(editingNewsId ? "News updated" : "News created");
      resetNewsForm();
    } catch (error: any) {
      console.error("Failed to save news:", error);
      toast.error(error.message || "Failed to save news item");
    } finally {
      setSavingPage(false);
    }
  }

  async function deleteNews(newsId: string) {
    if (!schoolId) {
      return;
    }

    try {
      const { error } = await supabase
        .from("news")
        .delete()
        .eq("id", newsId)
        .eq("school_id", schoolId);

      if (error) {
        throw error;
      }

      setNewsItems((prev) => prev.filter((item) => item.id !== newsId));
      if (editingNewsId === newsId) {
        resetNewsForm();
      }
      toast.success("News deleted");
    } catch (error: any) {
      console.error("Failed to delete news:", error);
      toast.error(error.message || "Failed to delete news");
    }
  }

  function resetEventForm() {
    setEditingEventId(null);
    setEventForm({
      ...emptyEventForm,
      start_date: nowAsLocalDateTime(),
      end_date: nowAsLocalDateTime(),
    });
  }

  function editEvent(item: EventItem) {
    setEditingEventId(item.id);
    setEventForm({
      title: item.title,
      description: item.description,
      excerpt: item.excerpt,
      event_type: item.event_type,
      location: item.location,
      start_date: item.start_date ? item.start_date.slice(0, 16) : nowAsLocalDateTime(),
      end_date: item.end_date ? item.end_date.slice(0, 16) : nowAsLocalDateTime(),
      is_all_day: item.is_all_day,
      slug: item.slug,
      seo_title: item.seo_title,
      seo_description: item.seo_description,
      published: item.published,
      published_at: item.published_at,
    });
  }

  async function saveEvent() {
    if (!schoolId) {
      return;
    }

    const title = eventForm.title.trim();
    if (!title) {
      toast.error("Event title is required.");
      return;
    }

    if (!eventForm.start_date || !eventForm.end_date) {
      toast.error("Event start and end dates are required.");
      return;
    }

    const slug = slugify(eventForm.slug || title);
    if (!slug) {
      toast.error("Invalid slug for event.");
      return;
    }

    const payload = {
      school_id: schoolId,
      title,
      description: eventForm.description.trim(),
      excerpt: eventForm.excerpt.trim(),
      event_type: eventForm.event_type.trim() || "meeting",
      location: eventForm.location.trim(),
      start_date: new Date(eventForm.start_date).toISOString(),
      end_date: new Date(eventForm.end_date).toISOString(),
      is_all_day: eventForm.is_all_day,
      slug,
      seo_title: eventForm.seo_title.trim(),
      seo_description: eventForm.seo_description.trim(),
      published: eventForm.published,
      published_at: eventForm.published ? new Date().toISOString() : null,
    };

    try {
      setSavingPage(true);

      const query = editingEventId
        ? supabase
            .from("events")
            .update(payload)
            .eq("id", editingEventId)
            .eq("school_id", schoolId)
            .select("id, title, description, excerpt, event_type, location, start_date, end_date, is_all_day, slug, seo_title, seo_description, published, published_at, created_at")
            .single()
        : supabase
            .from("events")
            .insert(payload)
            .select("id, title, description, excerpt, event_type, location, start_date, end_date, is_all_day, slug, seo_title, seo_description, published, published_at, created_at")
            .single();

      const { data, error } = await query;
      if (error) {
        throw error;
      }

      const item = data as EventItem;
      setEventItems((prev) =>
        editingEventId ? prev.map((entry) => (entry.id === item.id ? item : entry)) : [item, ...prev]
      );

      toast.success(editingEventId ? "Event updated" : "Event created");
      resetEventForm();
    } catch (error: any) {
      console.error("Failed to save event:", error);
      toast.error(error.message || "Failed to save event");
    } finally {
      setSavingPage(false);
    }
  }

  async function deleteEvent(eventId: string) {
    if (!schoolId) {
      return;
    }

    try {
      const { error } = await supabase
        .from("events")
        .delete()
        .eq("id", eventId)
        .eq("school_id", schoolId);

      if (error) {
        throw error;
      }

      setEventItems((prev) => prev.filter((item) => item.id !== eventId));
      if (editingEventId === eventId) {
        resetEventForm();
      }
      toast.success("Event deleted");
    } catch (error: any) {
      console.error("Failed to delete event:", error);
      toast.error(error.message || "Failed to delete event");
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

        <Tabs defaultValue="pages" className="space-y-4">
          <TabsList>
            <TabsTrigger value="pages" className="inline-flex items-center gap-2">
              <Pencil className="h-4 w-4" />
              Pages
            </TabsTrigger>
            <TabsTrigger value="news" className="inline-flex items-center gap-2">
              <Newspaper className="h-4 w-4" />
              News
            </TabsTrigger>
            <TabsTrigger value="events" className="inline-flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Events
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pages" className="space-y-4">
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
                          <Label>SEO Title</Label>
                          <Input
                            value={selectedPageSeoTitle}
                            onChange={(e) => setSelectedPageSeoTitle(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>SEO Image URL</Label>
                          <Input
                            value={selectedPageSeoImageUrl}
                            onChange={(e) => setSelectedPageSeoImageUrl(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>SEO Description</Label>
                        <Textarea
                          value={selectedPageSeoDescription}
                          onChange={(e) => setSelectedPageSeoDescription(e.target.value)}
                          className="min-h-[80px]"
                        />
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

                      <div className="space-y-3 rounded-lg border border-slate-200 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <Label>Section Builder</Label>
                            <p className="text-xs text-slate-500">
                              Add, reorder, hide, and edit sections without touching JSON.
                            </p>
                          </div>
                          <Button variant="outline" onClick={applyLandingPreset} className="inline-flex items-center gap-2">
                            <Sparkles className="h-4 w-4" />
                            Apply Template Preset
                          </Button>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Select value={newSectionType} onValueChange={(value: SectionType) => setNewSectionType(value)}>
                            <SelectTrigger className="w-[220px]">
                              <SelectValue placeholder="Select section type" />
                            </SelectTrigger>
                            <SelectContent>
                              {SECTION_PRESETS.map((preset) => (
                                <SelectItem key={preset.type} value={preset.type}>
                                  {preset.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button onClick={addSection} variant="outline" className="inline-flex items-center gap-2">
                            <Plus className="h-4 w-4" />
                            Add Section
                          </Button>
                        </div>

                        <div className="space-y-3">
                          {selectedPageSections.length === 0 ? (
                            <p className="text-sm text-slate-500">No sections yet. Add one from presets.</p>
                          ) : (
                            selectedPageSections.map((section, index) => {
                              const itemsText = (section.items || []).join("\n");
                              return (
                                <div
                                  key={section.id || `${section.type}-${index}`}
                                  className={cn(
                                    "rounded-lg border p-3",
                                    section.isVisible === false ? "border-slate-200 bg-slate-50" : "border-slate-300 bg-white"
                                  )}
                                >
                                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                    <div className="inline-flex items-center gap-2">
                                      <Badge variant="outline">{section.type || "text"}</Badge>
                                      <span className="text-xs text-slate-500">Section {index + 1}</span>
                                    </div>
                                    <div className="inline-flex items-center gap-1">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => moveSection(section.id!, -1)}
                                        disabled={index === 0}
                                      >
                                        <ArrowUp className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => moveSection(section.id!, 1)}
                                        disabled={index === selectedPageSections.length - 1}
                                      >
                                        <ArrowDown className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() =>
                                          updateSection(section.id!, { isVisible: section.isVisible === false })
                                        }
                                      >
                                        {section.isVisible === false ? (
                                          <EyeOff className="h-4 w-4" />
                                        ) : (
                                          <Eye className="h-4 w-4" />
                                        )}
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeSection(section.id!)}
                                      >
                                        <Trash2 className="h-4 w-4 text-red-600" />
                                      </Button>
                                    </div>
                                  </div>

                                  <div className="grid gap-3 md:grid-cols-2">
                                    <div className="space-y-2 md:col-span-2">
                                      <Label>Section Title</Label>
                                      <Input
                                        value={section.title || ""}
                                        onChange={(e) => updateSection(section.id!, { title: e.target.value })}
                                      />
                                    </div>
                                    <div className="space-y-2 md:col-span-2">
                                      <Label>Description</Label>
                                      <Textarea
                                        value={section.body || ""}
                                        onChange={(e) => updateSection(section.id!, { body: e.target.value })}
                                        className="min-h-[90px]"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label>CTA Label</Label>
                                      <Input
                                        value={section.ctaLabel || ""}
                                        onChange={(e) => updateSection(section.id!, { ctaLabel: e.target.value })}
                                        placeholder="Apply Now"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label>CTA Link</Label>
                                      <Input
                                        value={section.ctaHref || ""}
                                        onChange={(e) => updateSection(section.id!, { ctaHref: e.target.value })}
                                        placeholder="/admission"
                                      />
                                    </div>
                                    <div className="space-y-2 md:col-span-2">
                                      <Label>Items (one per line)</Label>
                                      <Textarea
                                        value={itemsText}
                                        onChange={(e) => updateSectionItems(section.id!, e.target.value)}
                                        className="min-h-[100px]"
                                        placeholder="For stats/timeline/faq use pairs like: Value|Label"
                                      />
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
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
          </TabsContent>

          <TabsContent value="news" className="space-y-4">
            <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
              <Card>
                <CardHeader>
                  <CardTitle>{editingNewsId ? "Edit News" : "Create News"}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input
                      value={newsForm.title}
                      onChange={(e) =>
                        setNewsForm((prev) => ({
                          ...prev,
                          title: e.target.value,
                          slug: prev.slug || slugify(e.target.value),
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Slug</Label>
                    <Input
                      value={newsForm.slug}
                      onChange={(e) => setNewsForm((prev) => ({ ...prev, slug: slugify(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Excerpt</Label>
                    <Textarea
                      value={newsForm.excerpt}
                      onChange={(e) => setNewsForm((prev) => ({ ...prev, excerpt: e.target.value }))}
                      className="min-h-[80px]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Content</Label>
                    <Textarea
                      value={newsForm.content}
                      onChange={(e) => setNewsForm((prev) => ({ ...prev, content: e.target.value }))}
                      className="min-h-[140px]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Image URL</Label>
                    <Input
                      value={newsForm.image_url}
                      onChange={(e) => setNewsForm((prev) => ({ ...prev, image_url: e.target.value }))}
                    />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>SEO Title</Label>
                      <Input
                        value={newsForm.seo_title}
                        onChange={(e) => setNewsForm((prev) => ({ ...prev, seo_title: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Publish</Label>
                      <div className="flex h-10 items-center rounded-md border px-3">
                        <Switch
                          checked={newsForm.published}
                          onCheckedChange={(checked) =>
                            setNewsForm((prev) => ({
                              ...prev,
                              published: checked,
                              published_at: checked ? new Date().toISOString() : null,
                            }))
                          }
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>SEO Description</Label>
                    <Textarea
                      value={newsForm.seo_description}
                      onChange={(e) => setNewsForm((prev) => ({ ...prev, seo_description: e.target.value }))}
                      className="min-h-[80px]"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button onClick={saveNews} disabled={savingPage}>
                      {savingPage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      {editingNewsId ? "Update News" : "Create News"}
                    </Button>
                    {editingNewsId && (
                      <Button variant="outline" onClick={resetNewsForm}>
                        Cancel Edit
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Published Workflow</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {newsItems.length === 0 ? (
                    <p className="text-sm text-slate-500">No news items yet.</p>
                  ) : (
                    newsItems.map((item) => (
                      <div key={item.id} className="rounded-lg border border-slate-200 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold text-slate-900">{item.title}</p>
                          <Badge variant="outline" className="uppercase text-[10px]">
                            {item.published ? "Published" : "Draft"}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">/{item.slug}</p>
                        <p className="mt-2 text-sm text-slate-600">{item.excerpt || "No excerpt provided."}</p>
                        <div className="mt-3 flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => editNews(item)}>
                            Edit
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => deleteNews(item.id)}>
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="events" className="space-y-4">
            <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
              <Card>
                <CardHeader>
                  <CardTitle>{editingEventId ? "Edit Event" : "Create Event"}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input
                      value={eventForm.title}
                      onChange={(e) =>
                        setEventForm((prev) => ({
                          ...prev,
                          title: e.target.value,
                          slug: prev.slug || slugify(e.target.value),
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Slug</Label>
                    <Input
                      value={eventForm.slug}
                      onChange={(e) => setEventForm((prev) => ({ ...prev, slug: slugify(e.target.value) }))}
                    />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Event Type</Label>
                      <Input
                        value={eventForm.event_type}
                        onChange={(e) => setEventForm((prev) => ({ ...prev, event_type: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Location</Label>
                      <Input
                        value={eventForm.location}
                        onChange={(e) => setEventForm((prev) => ({ ...prev, location: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Start</Label>
                      <Input
                        type="datetime-local"
                        value={eventForm.start_date}
                        onChange={(e) => setEventForm((prev) => ({ ...prev, start_date: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>End</Label>
                      <Input
                        type="datetime-local"
                        value={eventForm.end_date}
                        onChange={(e) => setEventForm((prev) => ({ ...prev, end_date: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Excerpt</Label>
                    <Textarea
                      value={eventForm.excerpt}
                      onChange={(e) => setEventForm((prev) => ({ ...prev, excerpt: e.target.value }))}
                      className="min-h-[80px]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      value={eventForm.description}
                      onChange={(e) => setEventForm((prev) => ({ ...prev, description: e.target.value }))}
                      className="min-h-[120px]"
                    />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>SEO Title</Label>
                      <Input
                        value={eventForm.seo_title}
                        onChange={(e) => setEventForm((prev) => ({ ...prev, seo_title: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Publish</Label>
                      <div className="flex h-10 items-center rounded-md border px-3">
                        <Switch
                          checked={eventForm.published}
                          onCheckedChange={(checked) =>
                            setEventForm((prev) => ({
                              ...prev,
                              published: checked,
                              published_at: checked ? new Date().toISOString() : null,
                            }))
                          }
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>SEO Description</Label>
                    <Textarea
                      value={eventForm.seo_description}
                      onChange={(e) => setEventForm((prev) => ({ ...prev, seo_description: e.target.value }))}
                      className="min-h-[80px]"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button onClick={saveEvent} disabled={savingPage}>
                      {savingPage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      {editingEventId ? "Update Event" : "Create Event"}
                    </Button>
                    {editingEventId && (
                      <Button variant="outline" onClick={resetEventForm}>
                        Cancel Edit
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Event List</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {eventItems.length === 0 ? (
                    <p className="text-sm text-slate-500">No events yet.</p>
                  ) : (
                    eventItems.map((item) => (
                      <div key={item.id} className="rounded-lg border border-slate-200 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold text-slate-900">{item.title}</p>
                          <Badge variant="outline" className="uppercase text-[10px]">
                            {item.published ? "Published" : "Draft"}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">/{item.slug}</p>
                        <p className="mt-2 text-sm text-slate-600">{new Date(item.start_date).toLocaleString()}</p>
                        <p className="text-sm text-slate-600">{item.location || "No location"}</p>
                        <div className="mt-3 flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => editEvent(item)}>
                            Edit
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => deleteEvent(item.id)}>
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
