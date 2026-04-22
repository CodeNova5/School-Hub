"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Upload, ExternalLink, Save, Globe, ArrowUp, ArrowDown, RotateCcw, RefreshCcw } from "lucide-react";
import { WEBSITE_SECTION_TEMPLATES } from "@/lib/website-builder";

interface SiteSettings {
    site_title: string;
    site_tagline: string;
    logo_url: string;
    hero_background_url: string;
    primary_color: string;
    secondary_color: string;
    contact_email: string;
    contact_phone: string;
    contact_address: string;
    is_website_enabled: boolean;
}

interface PageData {
    id: string;
    title: string;
    slug: string;
    status: "draft" | "published";
    seo_title: string;
    seo_description: string;
}

interface SectionData {
    id: string;
    section_key: string;
    section_label: string;
    is_visible: boolean;
    order_sequence: number;
    content: {
        heading?: string;
        subheading?: string;
        description?: string;
        image_url?: string;
        button_label?: string;
        button_link?: string;
        items?: string[];
        hero_card_badge?: string;
        hero_card_title?: string;
        hero_card_description?: string;
        hero_stats?: string[];
        mission?: string;
        vision?: string;
    };
}

interface MediaData {
    id: string;
    file_name: string;
    public_url: string;
    mime_type?: string;
    created_at: string;
    page_id: string | null;
}

interface SchoolData {
    id: string;
    name: string;
    subdomain: string | null;
}

const SECTION_EDITOR_CONFIG: Record<
    string,
    {
        descriptionLabel: string;
        itemsLabel: string;
        showSubheading: boolean;
        showDescription: boolean;
        showImage: boolean;
        showButton: boolean;
        showItems: boolean;
    }
> = {
    home: {
        descriptionLabel: "Hero Description",
        itemsLabel: "Highlights",
        showSubheading: true,
        showDescription: true,
        showImage: true,
        showButton: true,
        showItems: false,
    },
    about: {
        descriptionLabel: "About Text",
        itemsLabel: "About Highlights",
        showSubheading: false,
        showDescription: true,
        showImage: true,
        showButton: false,
        showItems: false,
    },
    programs: {
        descriptionLabel: "Programs Intro",
        itemsLabel: "Programs (one per line)",
        showSubheading: true,
        showDescription: false,
        showImage: false,
        showButton: false,
        showItems: true,
    },
    facilities: {
        descriptionLabel: "Facilities Intro",
        itemsLabel: "Facilities (one per line)",
        showSubheading: true,
        showDescription: false,
        showImage: false,
        showButton: false,
        showItems: true,
    },
    faculty: {
        descriptionLabel: "Faculty Intro",
        itemsLabel: "Faculty Cards",
        showSubheading: true,
        showDescription: true,
        showImage: true,
        showButton: false,
        showItems: false,
    },
    news: {
        descriptionLabel: "News Intro",
        itemsLabel: "News Headlines",
        showSubheading: true,
        showDescription: true,
        showImage: false,
        showButton: false,
        showItems: true,
    },
    testimonials: {
        descriptionLabel: "Testimonials Intro",
        itemsLabel: "Testimonials (one per line)",
        showSubheading: true,
        showDescription: true,
        showImage: false,
        showButton: false,
        showItems: true,
    },
    gallery: {
        descriptionLabel: "Gallery Intro",
        itemsLabel: "Gallery Captions",
        showSubheading: true,
        showDescription: false,
        showImage: true,
        showButton: false,
        showItems: true,
    },
    admissions: {
        descriptionLabel: "Admissions Details",
        itemsLabel: "Requirements (one per line)",
        showSubheading: true,
        showDescription: true,
        showImage: false,
        showButton: true,
        showItems: true,
    },
    contact: {
        descriptionLabel: "Contact Message",
        itemsLabel: "Contact Points",
        showSubheading: true,
        showDescription: true,
        showImage: false,
        showButton: false,
        showItems: false,
    },
};

const DEFAULT_SETTINGS: SiteSettings = {
    site_title: "School Website",
    site_tagline: "Excellence in education",
    logo_url: "",
    hero_background_url: "",
    primary_color: "#1e3a8a",
    secondary_color: "#059669",
    contact_email: "",
    contact_phone: "",
    contact_address: "",
    is_website_enabled: true,
};

export default function WebsiteBuilderPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);

    const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
    const [page, setPage] = useState<PageData | null>(null);
    const [sections, setSections] = useState<SectionData[]>([]);
    const [media, setMedia] = useState<MediaData[]>([]);
    const [school, setSchool] = useState<SchoolData | null>(null);
    const [selectedMediaBySection, setSelectedMediaBySection] = useState<Record<string, string>>({});
    const [activeEditorTab, setActiveEditorTab] = useState("settings");
    const [previewNonce, setPreviewNonce] = useState(0);
    const [uploadDisplayName, setUploadDisplayName] = useState("");

    const sortedSections = useMemo(
        () => [...sections].sort((a, b) => a.order_sequence - b.order_sequence),
        [sections]
    );

    const activeSection = useMemo(
        () => sortedSections.find((section) => `section-${section.id}` === activeEditorTab) || null,
        [activeEditorTab, sortedSections]
    );

    async function loadWebsiteBuilder() {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/website/homepage", { cache: "no-store" });
            const payload = await res.json();

            if (!res.ok || !payload.success) {
                throw new Error(payload.error || "Failed to load Website Builder");
            }

            setSettings(payload.data.settings || DEFAULT_SETTINGS);
            setPage(payload.data.page || null);
            setSections(payload.data.sections || []);
            setMedia(payload.data.media || []);
            setSchool(payload.data.school || null);
        } catch (error: any) {
            toast.error(error.message || "Unable to load Website Builder");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadWebsiteBuilder();
    }, []);

    useEffect(() => {
        if (activeEditorTab === "settings") return;
        const tabExists = sortedSections.some((section) => `section-${section.id}` === activeEditorTab);
        if (!tabExists) {
            setActiveEditorTab("settings");
        }
    }, [activeEditorTab, sortedSections]);

    function updateSectionContent(sectionId: string, field: string, value: string | string[]) {
        setSections((prev) =>
            prev.map((section) =>
                section.id === sectionId
                    ? {
                        ...section,
                        content: {
                            ...section.content,
                            [field]: value,
                        },
                    }
                    : section
            )
        );
    }

    function moveSection(sectionId: string, direction: "up" | "down") {
        const current = [...sortedSections];
        const index = current.findIndex((section) => section.id === sectionId);
        if (index < 0) return;
        if (direction === "up" && index === 0) return;
        if (direction === "down" && index === current.length - 1) return;

        const swapIndex = direction === "up" ? index - 1 : index + 1;
        const a = current[index];
        const b = current[swapIndex];

        current[index] = { ...b, order_sequence: a.order_sequence };
        current[swapIndex] = { ...a, order_sequence: b.order_sequence };
        setSections(current);
    }

    async function saveAll() {
        if (!page) return;

        setSaving(true);
        try {
            const sectionPayload = sections.map((section) => ({
                id: section.id,
                section_label: section.section_label,
                is_visible: section.is_visible,
                order_sequence: section.order_sequence,
                content: section.content,
            }));

            const res = await fetch("/api/admin/website/homepage", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    settings,
                    page,
                    sections: sectionPayload,
                }),
            });

            const payload = await res.json();
            if (!res.ok || !payload.success) {
                throw new Error(payload.error || "Failed to save Website Builder content");
            }

            toast.success("Website Builder changes saved");
            await loadWebsiteBuilder();
        } catch (error: any) {
            toast.error(error.message || "Save failed");
        } finally {
            setSaving(false);
        }
    }

    async function uploadMedia(file: File, displayName?: string) {
        if (!page) return;

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("type", "website_media");
            formData.append("page_id", page.id);
            if (displayName?.trim()) {
                formData.append("display_name", displayName.trim());
            }

            const res = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            const payload = await res.json();
            if (!res.ok || !payload.success) {
                throw new Error(payload.error || "Media upload failed");
            }

            toast.success("Media uploaded successfully");
            setUploadDisplayName("");
            await loadWebsiteBuilder();
        } catch (error: any) {
            toast.error(error.message || "Unable to upload media");
        } finally {
            setUploading(false);
        }
    }

    function isPreviewableImage(item: MediaData) {
        const url = item.public_url.toLowerCase();
        const mime = item.mime_type?.toLowerCase() || "";
        if (mime.startsWith("image/")) return true;
        return [".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"].some((ext) => url.includes(ext));
    }

    function applyMediaToSection(sectionId: string) {
        const selectedUrl = selectedMediaBySection[sectionId];
        if (!selectedUrl) {
            toast.error("Select a media item first");
            return;
        }

        updateSectionContent(sectionId, "image_url", selectedUrl);
        toast.success("Section image updated from media library");
    }

    function resetToTemplateDefaults() {
        setSections((prev) =>
            prev.map((section) => {
                const template = WEBSITE_SECTION_TEMPLATES.find((item) => item.key === section.section_key);
                if (!template) return section;

                return {
                    ...section,
                    section_label: template.label,
                    is_visible: template.visible,
                    order_sequence: template.order,
                    content: {
                        ...template.content,
                    },
                };
            })
        );

        toast.success("Section defaults restored. Click Save Changes to persist.");
    }

    function getPublicUrl() {
        if (typeof window === "undefined") return "#";

        if (!school?.subdomain) return "#";

        const protocol = window.location.protocol;
        const host = window.location.host;
        const [hostname, port] = host.split(":");
        const withPort = (value: string) => (port ? `${value}:${port}` : value);

        if (hostname === "localhost" || hostname.endsWith(".localhost")) {
            return `${protocol}//${withPort(`${school.subdomain}.localhost`)}`;
        }

        const parts = hostname.split(".");
        if (parts.length >= 3) {
            const rootDomain = parts.slice(1).join(".");
            return `${protocol}//${withPort(`${school.subdomain}.${rootDomain}`)}`;
        }

        return `${protocol}//${withPort(`${school.subdomain}.${hostname}`)}`;
    }

    function getPreviewUrl() {
        const publicUrl = getPublicUrl();
        if (publicUrl === "#") return "#";
        return `${publicUrl}?preview=1`;
    }

    function getSectionPreviewUrl(sectionKey?: string) {
        const previewUrl = getPreviewUrl();
        if (previewUrl === "#") return "#";
        return sectionKey ? `${previewUrl}#${sectionKey}` : previewUrl;
    }

    function refreshPreview() {
        setPreviewNonce((prev) => prev + 1);
    }

    return (
        <DashboardLayout role="admin">
            <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Website Builder</h1>
                        <p className="text-sm text-slate-600">
                            Edit your school homepage, upload media assets, and publish to your school subdomain.
                        </p>
                        {school?.subdomain ? (
                            <p className="mt-1 text-xs text-slate-500">Live URL target: {school.subdomain}</p>
                        ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                        {page?.status === "published" ? (
                            <Badge className="bg-emerald-600">Published</Badge>
                        ) : (
                            <Badge variant="outline">Draft</Badge>
                        )}
                        <Button variant="outline" asChild>
                            <a href={getPreviewUrl()} target="_blank" rel="noreferrer">
                                <ExternalLink className="mr-2 h-4 w-4" />
                                Preview Draft
                            </a>
                        </Button>
                        <Button onClick={saveAll} disabled={saving || loading}>
                            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Save Changes
                        </Button>
                        <Button variant="outline" onClick={resetToTemplateDefaults} disabled={loading || saving}>
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Apply Template Defaults
                        </Button>
                    </div>
                </div>

                {loading ? (
                    <div className="rounded-lg border bg-white p-8 text-center text-sm text-slate-500">
                        <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin" />
                        Loading website builder...
                    </div>
                ) : (
                    <>
                        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
                            <div className="space-y-6">
                                <div className="rounded-lg border bg-white p-4">
                                    <div className="mb-3 flex items-center justify-between gap-2">
                                        <div>
                                            <h2 className="text-lg font-semibold text-slate-900">Homepage Editor</h2>
                                            <p className="text-xs text-slate-500">Edit one segment at a time to stay focused.</p>
                                        </div>
                                        <div className="text-xs text-slate-500">Reorder with arrows, then save</div>
                                    </div>

                                    <Tabs value={activeEditorTab} onValueChange={setActiveEditorTab} className="space-y-4">
                                        <div className="relative">
                                            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-white to-transparent" />
                                            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-white to-transparent" />
                                            <TabsList className="h-auto w-full justify-start gap-2 overflow-x-auto rounded-xl border border-slate-200 bg-[linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)] p-2 shadow-sm">
                                            <TabsTrigger
                                                value="settings"
                                                className="whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition-all hover:bg-white/70 hover:text-slate-900 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm"
                                            >
                                                Global Settings
                                            </TabsTrigger>
                                            {sortedSections.map((section) => (
                                                <TabsTrigger
                                                    key={section.id}
                                                    value={`section-${section.id}`}
                                                    className="whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition-all hover:bg-white/70 hover:text-slate-900 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm"
                                                >
                                                    {section.section_label || section.section_key}
                                                </TabsTrigger>
                                            ))}
                                            </TabsList>
                                        </div>

                                        <TabsContent value="settings" className="space-y-4">
                                            <div className="grid gap-4 rounded-lg border bg-white p-4 md:grid-cols-2">
                                                <div className="space-y-2">
                                                    <Label>Site Title</Label>
                                                    <Input
                                                        value={settings.site_title}
                                                        onChange={(e) => setSettings((prev) => ({ ...prev, site_title: e.target.value }))}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Tagline</Label>
                                                    <Input
                                                        value={settings.site_tagline}
                                                        onChange={(e) => setSettings((prev) => ({ ...prev, site_tagline: e.target.value }))}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Primary Color</Label>
                                                    <Input
                                                        value={settings.primary_color}
                                                        onChange={(e) => setSettings((prev) => ({ ...prev, primary_color: e.target.value }))}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Secondary Color</Label>
                                                    <Input
                                                        value={settings.secondary_color}
                                                        onChange={(e) => setSettings((prev) => ({ ...prev, secondary_color: e.target.value }))}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Logo URL</Label>
                                                    <Input
                                                        value={settings.logo_url}
                                                        onChange={(e) => setSettings((prev) => ({ ...prev, logo_url: e.target.value }))}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Hero Background URL</Label>
                                                    <Input
                                                        value={settings.hero_background_url}
                                                        onChange={(e) =>
                                                            setSettings((prev) => ({ ...prev, hero_background_url: e.target.value }))
                                                        }
                                                    />
                                                </div>
                                                <div className="flex items-center gap-3 md:col-span-2">
                                                    <Switch
                                                        checked={settings.is_website_enabled}
                                                        onCheckedChange={(checked) =>
                                                            setSettings((prev) => ({ ...prev, is_website_enabled: checked }))
                                                        }
                                                    />
                                                    <Label>Website enabled</Label>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Contact Email</Label>
                                                    <Input
                                                        value={settings.contact_email}
                                                        onChange={(e) => setSettings((prev) => ({ ...prev, contact_email: e.target.value }))}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Contact Phone</Label>
                                                    <Input
                                                        value={settings.contact_phone}
                                                        onChange={(e) => setSettings((prev) => ({ ...prev, contact_phone: e.target.value }))}
                                                    />
                                                </div>
                                                <div className="space-y-2 md:col-span-2">
                                                    <Label>Contact Address</Label>
                                                    <Textarea
                                                        rows={2}
                                                        value={settings.contact_address}
                                                        onChange={(e) => setSettings((prev) => ({ ...prev, contact_address: e.target.value }))}
                                                    />
                                                </div>
                                            </div>
                                        </TabsContent>

                                        {sortedSections.map((section) => {
                                            const editorConfig =
                                                SECTION_EDITOR_CONFIG[section.section_key] || SECTION_EDITOR_CONFIG.contact;

                                            return (
                                                <TabsContent key={section.id} value={`section-${section.id}`} className="space-y-3">
                                                    <div className="rounded-lg border bg-white p-4">
                                                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                                            <div className="flex items-center gap-2">
                                                                <Badge variant="outline">{section.section_key}</Badge>
                                                                <Input
                                                                    className="h-8 w-60"
                                                                    value={section.section_label}
                                                                    onChange={(e) =>
                                                                        setSections((prev) =>
                                                                            prev.map((item) =>
                                                                                item.id === section.id
                                                                                    ? { ...item, section_label: e.target.value }
                                                                                    : item
                                                                            )
                                                                        )
                                                                    }
                                                                />
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <Button
                                                                    type="button"
                                                                    size="icon"
                                                                    variant="outline"
                                                                    onClick={() => moveSection(section.id, "up")}
                                                                >
                                                                    <ArrowUp className="h-4 w-4" />
                                                                </Button>
                                                                <Button
                                                                    type="button"
                                                                    size="icon"
                                                                    variant="outline"
                                                                    onClick={() => moveSection(section.id, "down")}
                                                                >
                                                                    <ArrowDown className="h-4 w-4" />
                                                                </Button>
                                                                <Switch
                                                                    checked={section.is_visible}
                                                                    onCheckedChange={(checked) =>
                                                                        setSections((prev) =>
                                                                            prev.map((item) =>
                                                                                item.id === section.id ? { ...item, is_visible: checked } : item
                                                                            )
                                                                        )
                                                                    }
                                                                />
                                                                <span className="text-xs text-slate-500">Visible</span>
                                                            </div>
                                                        </div>

                                                        <div className="grid gap-3 md:grid-cols-2">
                                                            <div className="space-y-1">
                                                                <Label>Heading</Label>
                                                                <Input
                                                                    value={section.content.heading || ""}
                                                                    onChange={(e) =>
                                                                        updateSectionContent(section.id, "heading", e.target.value)
                                                                    }
                                                                />
                                                            </div>

                                                            {editorConfig.showSubheading ? (
                                                                <div className="space-y-1">
                                                                    <Label>Subheading</Label>
                                                                    <Input
                                                                        value={section.content.subheading || ""}
                                                                        onChange={(e) =>
                                                                            updateSectionContent(section.id, "subheading", e.target.value)
                                                                        }
                                                                    />
                                                                </div>
                                                            ) : null}

                                                            {editorConfig.showDescription ? (
                                                                <div className="space-y-1 md:col-span-2">
                                                                    <Label>{editorConfig.descriptionLabel}</Label>
                                                                    <Textarea
                                                                        rows={3}
                                                                        value={section.content.description || ""}
                                                                        onChange={(e) =>
                                                                            updateSectionContent(section.id, "description", e.target.value)
                                                                        }
                                                                    />
                                                                </div>
                                                            ) : null}

                                                            {section.section_key === "about" ? (
                                                                <>
                                                                    <div className="space-y-1 md:col-span-2">
                                                                        <Label>Mission Statement</Label>
                                                                        <Textarea
                                                                            rows={3}
                                                                            value={section.content.mission || ""}
                                                                            onChange={(e) =>
                                                                                updateSectionContent(section.id, "mission", e.target.value)
                                                                            }
                                                                            placeholder="Our Mission&#10;&#10;To provide quality education..."
                                                                        />
                                                                    </div>
                                                                    <div className="space-y-1 md:col-span-2">
                                                                        <Label>Vision Statement</Label>
                                                                        <Textarea
                                                                            rows={3}
                                                                            value={section.content.vision || ""}
                                                                            onChange={(e) =>
                                                                                updateSectionContent(section.id, "vision", e.target.value)
                                                                            }
                                                                            placeholder="Our Vision&#10;&#10;A learning community..."
                                                                        />
                                                                    </div>
                                                                </>
                                                            ) : null}

                                                            {editorConfig.showImage ? (
                                                                <div className="space-y-1 md:col-span-2">
                                                                    <Label>Image URL</Label>
                                                                    <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                                                                        <Input
                                                                            value={section.content.image_url || ""}
                                                                            onChange={(e) =>
                                                                                updateSectionContent(section.id, "image_url", e.target.value)
                                                                            }
                                                                        />
                                                                        <select
                                                                            className="h-10 rounded-md border border-slate-200 px-2 text-sm"
                                                                            value={selectedMediaBySection[section.id] || ""}
                                                                            onChange={(e) =>
                                                                                setSelectedMediaBySection((prev) => ({
                                                                                    ...prev,
                                                                                    [section.id]: e.target.value,
                                                                                }))
                                                                            }
                                                                        >
                                                                            <option value="">Pick uploaded media...</option>
                                                                            {media.map((item) => (
                                                                                <option key={item.id} value={item.public_url}>
                                                                                    {item.file_name}
                                                                                </option>
                                                                            ))}
                                                                        </select>
                                                                    </div>
                                                                    <div className="mt-2">
                                                                        <Button
                                                                            type="button"
                                                                            variant="outline"
                                                                            size="sm"
                                                                            onClick={() => applyMediaToSection(section.id)}
                                                                        >
                                                                            Use Selected Media
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            ) : null}

                                                            {editorConfig.showButton ? (
                                                                <>
                                                                    <div className="space-y-1">
                                                                        <Label>Button Label</Label>
                                                                        <Input
                                                                            value={section.content.button_label || ""}
                                                                            onChange={(e) =>
                                                                                updateSectionContent(section.id, "button_label", e.target.value)
                                                                            }
                                                                        />
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <Label>Button Link</Label>
                                                                        <Input
                                                                            value={section.content.button_link || ""}
                                                                            onChange={(e) =>
                                                                                updateSectionContent(section.id, "button_link", e.target.value)
                                                                            }
                                                                        />
                                                                    </div>
                                                                </>
                                                            ) : null}

                                                            {editorConfig.showItems ? (
                                                                <div className="space-y-1 md:col-span-2">
                                                                    <Label>{editorConfig.itemsLabel}</Label>
                                                                    <Textarea
                                                                        rows={4}
                                                                        value={(section.content.items || []).join("\n")}
                                                                        onChange={(e) =>
                                                                            updateSectionContent(
                                                                                section.id,
                                                                                "items",
                                                                                e.target.value
                                                                                    .split("\n")
                                                                                    .map((item) => item.trim())
                                                                                    .filter(Boolean)
                                                                            )
                                                                        }
                                                                    />
                                                                </div>
                                                            ) : null}

                                                            {section.section_key === "home" ? (
                                                                <>
                                                                    <div className="space-y-1 md:col-span-2">
                                                                        <Label>Hero Card Badge</Label>
                                                                        <Input
                                                                            value={section.content.hero_card_badge || ""}
                                                                            onChange={(e) =>
                                                                                updateSectionContent(
                                                                                    section.id,
                                                                                    "hero_card_badge",
                                                                                    e.target.value
                                                                                )
                                                                            }
                                                                            placeholder="Student Focus"
                                                                        />
                                                                    </div>
                                                                    <div className="space-y-1 md:col-span-2">
                                                                        <Label>Hero Card Title</Label>
                                                                        <Textarea
                                                                            rows={2}
                                                                            value={section.content.hero_card_title || ""}
                                                                            onChange={(e) =>
                                                                                updateSectionContent(
                                                                                    section.id,
                                                                                    "hero_card_title",
                                                                                    e.target.value
                                                                                )
                                                                            }
                                                                            placeholder="Modern learning. Strong values. Real outcomes."
                                                                        />
                                                                    </div>
                                                                    <div className="space-y-1 md:col-span-2">
                                                                        <Label>Hero Card Description</Label>
                                                                        <Textarea
                                                                            rows={3}
                                                                            value={section.content.hero_card_description || ""}
                                                                            onChange={(e) =>
                                                                                updateSectionContent(
                                                                                    section.id,
                                                                                    "hero_card_description",
                                                                                    e.target.value
                                                                                )
                                                                            }
                                                                            placeholder="A school website built to communicate trust, clarity, and excellence from the first glance."
                                                                        />
                                                                    </div>
                                                                    <div className="space-y-1 md:col-span-2">
                                                                        <Label>Hero Stats (value|label, one per line)</Label>
                                                                        <Textarea
                                                                            rows={4}
                                                                            value={(section.content.hero_stats || []).join("\n")}
                                                                            onChange={(e) =>
                                                                                updateSectionContent(
                                                                                    section.id,
                                                                                    "hero_stats",
                                                                                    e.target.value
                                                                                        .split("\n")
                                                                                        .map((item) => item.trim())
                                                                                        .filter(Boolean)
                                                                                )
                                                                            }
                                                                            placeholder={"850+|Students\n95%|Pass Rate\n25+|Years\n50+|Faculty"}
                                                                        />
                                                                    </div>
                                                                </>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                </TabsContent>
                                            );
                                        })}
                                    </Tabs>
                                </div>

                                <div className="rounded-lg border bg-white p-4">
                                    <div className="mb-4 flex items-center justify-between">
                                        <h2 className="text-lg font-semibold text-slate-900">Media Library (GitHub)</h2>
                                        <div className="flex w-full max-w-xl items-center justify-end gap-2">
                                            <Input
                                                value={uploadDisplayName}
                                                onChange={(e) => setUploadDisplayName(e.target.value)}
                                                placeholder="Asset name (optional, for easier reuse)"
                                                className="h-10"
                                            />
                                            <label className="inline-flex cursor-pointer items-center">
                                                <input
                                                    type="file"
                                                    className="hidden"
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) {
                                                            uploadMedia(file, uploadDisplayName);
                                                            e.currentTarget.value = "";
                                                        }
                                                    }}
                                                />
                                                <span className="inline-flex items-center rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white">
                                                    {uploading ? (
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <Upload className="mr-2 h-4 w-4" />
                                                    )}
                                                    Upload Asset
                                                </span>
                                            </label>
                                        </div>
                                    </div>

                                    {media.length === 0 ? (
                                        <p className="text-sm text-slate-500">No media uploaded yet.</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {media.map((item) => (
                                                <div
                                                    key={item.id}
                                                    className="flex flex-wrap items-center justify-between gap-3 rounded border p-2"
                                                >
                                                    <div className="flex min-w-0 flex-1 items-center gap-3">
                                                        <div className="h-14 w-14 overflow-hidden rounded border bg-slate-100">
                                                            {isPreviewableImage(item) ? (
                                                                <img
                                                                    src={item.public_url}
                                                                    alt={item.file_name}
                                                                    className="h-full w-full object-cover"
                                                                />
                                                            ) : (
                                                                <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-slate-500">
                                                                    FILE
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="truncate text-sm font-medium text-slate-800">{item.file_name}</p>
                                                            <p className="text-xs text-slate-500">
                                                                {item.mime_type || "file"} • {new Date(item.created_at).toLocaleString()}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => {
                                                                navigator.clipboard.writeText(item.public_url);
                                                                toast.success("Media URL copied");
                                                            }}
                                                        >
                                                            Copy URL
                                                        </Button>
                                                        <Button type="button" variant="outline" size="sm" asChild>
                                                            <a href={item.public_url} target="_blank" rel="noreferrer">
                                                                Open
                                                            </a>
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="rounded-lg border bg-white p-4">
                                    <h2 className="mb-3 text-lg font-semibold text-slate-900">Publishing</h2>
                                    <div className="flex flex-wrap items-center gap-3">
                                        <Button
                                            variant="outline"
                                            onClick={() => setPage((prev) => (prev ? { ...prev, status: "draft" } : prev))}
                                        >
                                            Save as Draft
                                        </Button>
                                        <Button
                                            onClick={() => setPage((prev) => (prev ? { ...prev, status: "published" } : prev))}
                                            className="bg-emerald-600 hover:bg-emerald-700"
                                        >
                                            <Globe className="mr-2 h-4 w-4" />
                                            Mark as Published
                                        </Button>
                                        <span className="text-sm text-slate-500">
                                            Click Save Changes after selecting your desired status.
                                        </span>
                                    </div>
                                </div>

                                <Separator />
                                <p className="text-xs text-slate-500">
                                    Sections scaffolded from your intended layout: {WEBSITE_SECTION_TEMPLATES.map((s) => s.key).join(", ")}.
                                </p>
                            </div>

                            <div className="space-y-4 xl:sticky xl:top-4">
                                <div className="rounded-lg border bg-white p-4">
                                    <div className="mb-3 flex items-center justify-between gap-3">
                                        <div>
                                            <h2 className="text-lg font-semibold text-slate-900">Live Preview</h2>
                                            <p className="text-xs text-slate-500">
                                                Focused on: {activeSection?.section_label || activeSection?.section_key || "full page"}
                                            </p>
                                        </div>
                                        <Button type="button" variant="outline" size="sm" onClick={refreshPreview}>
                                            <RefreshCcw className="mr-2 h-4 w-4" />
                                            Refresh
                                        </Button>
                                    </div>

                                    {getSectionPreviewUrl(activeSection?.section_key) === "#" ? (
                                        <div className="rounded-md border border-dashed bg-slate-50 p-6 text-sm text-slate-500">
                                            Preview unavailable until your school subdomain is configured.
                                        </div>
                                    ) : (
                                        <div className="overflow-hidden rounded-md border bg-slate-950">
                                            <iframe
                                                key={`${activeSection?.section_key || "page"}-${previewNonce}`}
                                                title="Website Preview"
                                                src={getSectionPreviewUrl(activeSection?.section_key)}
                                                className="h-[680px] w-full bg-white"
                                            />
                                        </div>
                                    )}

                                    <div className="mt-3 space-y-2 text-xs text-slate-500">
                                        <p>Preview shows your saved draft version for admins.</p>
                                        <p>After edits, click Save Changes then Refresh for the newest view.</p>
                                    </div>

                                    <Button variant="outline" className="mt-3 w-full" asChild>
                                        <a href={getPreviewUrl()} target="_blank" rel="noreferrer">
                                            <ExternalLink className="mr-2 h-4 w-4" />
                                            Open Full Preview
                                        </a>
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </>
                )}
                    </div>
        </DashboardLayout>
    );
}
