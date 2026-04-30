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
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Upload, ExternalLink, Save, Globe, ArrowUp, ArrowDown, RotateCcw, RefreshCcw, Plus, Trash2, CheckCircle2, AlertTriangle } from "lucide-react";
import {
    WEBSITE_COLOR_THEME_PRESETS,
    WEBSITE_DEFAULT_SITE_SETTINGS,
    getWebsiteSectionTemplatesForPage,
    getWebsiteGlobalSettingsQualification,
    isWebsiteSectionCustomized,
} from "@/lib/website-builder";

type WebsitePageSlug = "home" | "hall-of-fame" | "academics" | "contact";

const PAGE_OPTIONS: Array<{ slug: WebsitePageSlug; label: string }> = [
    { slug: "home", label: "Homepage" },
    { slug: "hall-of-fame", label: "Hall of Fame" },
    { slug: "academics", label: "Academics" },
    { slug: "contact", label: "Contact Page" },
];

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
        admissions_requirements?: string[];
        admissions_steps?: string[];
        contact_info_title?: string;
        contact_form_title?: string;
        contact_form_button_label?: string;
        contact_address_lines?: string[];
        contact_phone_lines?: string[];
        contact_email_lines?: string[];
        contact_hours_lines?: string[];
        program_items?: ProgramItem[];
        facility_items?: FacilityItem[];
        faculty_items?: FacultyItem[];
        news_items?: NewsItem[];
        testimonial_items?: TestimonialItem[];
        gallery_items?: GalleryItem[];
        academics_cards?: AcademicsShowcaseCardItem[];
    };
}

interface ProgramItem {
    title: string;
    description: string;
    icon?: string;
    image_url?: string;
}

interface FacilityItem {
    title: string;
    description: string;
    icon?: string;
    image_url?: string;
}

interface FacultyItem {
    title: string;
    position?: string;
    description: string;
    image_url?: string;
}

interface NewsItem {
    title: string;
    description: string;
}

interface TestimonialItem {
    text: string;
    author: string;
    role?: string;
}

interface GalleryItem {
    image_url: string;
    caption?: string;
}

interface AcademicsShowcaseCardItem {
    image_url: string;
    sample_subjects: string[];
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
        itemsLabel: "Programs",
        showSubheading: true,
        showDescription: false,
        showImage: false,
        showButton: false,
        showItems: false,
    },
    facilities: {
        descriptionLabel: "Facilities Intro",
        itemsLabel: "Facilities",
        showSubheading: true,
        showDescription: false,
        showImage: false,
        showButton: false,
        showItems: false,
    },
    faculty: {
        descriptionLabel: "Faculty Intro",
        itemsLabel: "Faculty Cards",
        showSubheading: true,
        showDescription: false,
        showImage: false,
        showButton: false,
        showItems: false,
    },
    news: {
        descriptionLabel: "News Intro",
        itemsLabel: "News Headlines",
        showSubheading: true,
        showDescription: false,
        showImage: false,
        showButton: false,
        showItems: false,
    },
    testimonials: {
        descriptionLabel: "Testimonials Intro",
        itemsLabel: "Testimonials",
        showSubheading: true,
        showDescription: false,
        showImage: false,
        showButton: false,
        showItems: false,
    },
    gallery: {
        descriptionLabel: "Gallery Intro",
        itemsLabel: "Gallery Images",
        showSubheading: true,
        showDescription: false,
        showImage: false,
        showButton: false,
        showItems: false,
    },
    admissions: {
        descriptionLabel: "Admissions Details",
        itemsLabel: "Requirements (one per line)",
        showSubheading: true,
        showDescription: true,
        showImage: false,
        showButton: true,
        showItems: false,
    },
    contact: {
        descriptionLabel: "Contact Message",
        itemsLabel: "Contact Points",
        showSubheading: true,
        showDescription: false,
        showImage: false,
        showButton: false,
        showItems: false,
    },
    achievements_hero: {
        descriptionLabel: "Hero Description",
        itemsLabel: "Highlights",
        showSubheading: true,
        showDescription: true,
        showImage: true,
        showButton: false,
        showItems: false,
    },
    achievements_timeline: {
        descriptionLabel: "Timeline Description",
        itemsLabel: "Timeline Entries (Year | Achievement)",
        showSubheading: true,
        showDescription: false,
        showImage: false,
        showButton: false,
        showItems: true,
    },
    hall_of_fame: {
        descriptionLabel: "Hall Of Fame Intro",
        itemsLabel: "Hall Of Fame Cards",
        showSubheading: true,
        showDescription: false,
        showImage: false,
        showButton: false,
        showItems: false,
    },
    achievements_awards: {
        descriptionLabel: "Awards Intro",
        itemsLabel: "Awards",
        showSubheading: true,
        showDescription: false,
        showImage: false,
        showButton: false,
        showItems: false,
    },
    achievements_cta: {
        descriptionLabel: "CTA Message",
        itemsLabel: "CTA Notes",
        showSubheading: true,
        showDescription: true,
        showImage: false,
        showButton: true,
        showItems: false,
    },
    academics_hero: {
        descriptionLabel: "Hero Description",
        itemsLabel: "Highlights",
        showSubheading: true,
        showDescription: false,
        showImage: true,
        showButton: true,
        showItems: false,
    },
};

const DEFAULT_SETTINGS: SiteSettings = WEBSITE_DEFAULT_SITE_SETTINGS;

const HOME_SECTION_TEMPLATES = getWebsiteSectionTemplatesForPage("home");

const DEFAULT_PROGRAM_ITEMS: ProgramItem[] = (
    HOME_SECTION_TEMPLATES.find((section) => section.key === "programs")?.content.program_items || []
).map((item) => ({
    title: item.title || "",
    description: item.description || "",
    icon: item.icon || "📘",
    image_url: item.image_url || "",
}));

const DEFAULT_FACILITY_ITEMS: FacilityItem[] = (
    HOME_SECTION_TEMPLATES.find((section) => section.key === "facilities")?.content.facility_items || []
).map((item) => ({
    title: item.title || "",
    description: item.description || "",
    icon: item.icon || "🏢",
    image_url: item.image_url || "",
}));

const DEFAULT_FACULTY_ITEMS: FacultyItem[] = (
    HOME_SECTION_TEMPLATES.find((section) => section.key === "faculty")?.content.faculty_items || []
).map((item) => ({
    title: item.title || "",
    position: item.position || "",
    description: item.description || "",
    image_url: item.image_url || "",
}));

const DEFAULT_NEWS_ITEMS: NewsItem[] = (
    HOME_SECTION_TEMPLATES.find((section) => section.key === "news")?.content.news_items || []
).map((item) => ({
    title: item.title || "",
    description: item.description || "",
}));

const DEFAULT_TESTIMONIAL_ITEMS: TestimonialItem[] = (
    HOME_SECTION_TEMPLATES.find((section) => section.key === "testimonials")?.content.testimonial_items || []
).map((item) => ({
    text: item.text || "",
    author: item.author || "",
    role: item.role || "",
}));

const DEFAULT_GALLERY_ITEMS: GalleryItem[] = (
    HOME_SECTION_TEMPLATES.find((section) => section.key === "gallery")?.content.gallery_items || []
).map((item) => ({
    image_url: item.image_url || "",
    caption: item.caption || "",
}));

function normalizeAcademicsCardSubjects(value: string[] | string | undefined) {
    if (Array.isArray(value)) {
        return value.map((item) => item.trim()).filter(Boolean);
    }

    if (typeof value === "string") {
        return value
            .split(/\r?\n|,/) 
            .map((item) => item.trim())
            .filter(Boolean);
    }

    return [];
}

function sanitizeAcademicsCards(cards: AcademicsShowcaseCardItem[]) {
    return cards.map((card) => ({
        image_url: (card.image_url || "").trim(),
        sample_subjects: normalizeAcademicsCardSubjects(card.sample_subjects),
    }));
}

function buildEditorSnapshot(settings: SiteSettings, page: PageData | null, sections: SectionData[]) {
    return JSON.stringify({
        settings,
        page: page
            ? {
                id: page.id,
                title: page.title,
                slug: page.slug,
                status: page.status,
                seo_title: page.seo_title,
                seo_description: page.seo_description,
            }
            : null,
        sections: [...sections]
            .sort((a, b) => a.order_sequence - b.order_sequence)
            .map((section) => ({
                id: section.id,
                section_key: section.section_key,
                section_label: section.section_label,
                is_visible: section.is_visible,
                order_sequence: section.order_sequence,
                content: section.content,
            })),
    });
}

export default function WebsiteBuilderPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savingSectionId, setSavingSectionId] = useState<string | null>(null);
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
    const [lastSavedSnapshot, setLastSavedSnapshot] = useState("");
    const [selectedPageSlug, setSelectedPageSlug] = useState<WebsitePageSlug>("home");

    const sortedSections = useMemo(
        () => [...sections].sort((a, b) => a.order_sequence - b.order_sequence),
        [sections]
    );

    const editableSections = useMemo(
        () =>
            selectedPageSlug === "academics"
                ? sortedSections.filter((section) => section.section_key === "academics_hero")
                : sortedSections,
        [selectedPageSlug, sortedSections]
    );

    const activeSection = useMemo(
        () => editableSections.find((section) => `section-${section.id}` === activeEditorTab) || null,
        [activeEditorTab, editableSections]
    );

    const currentSnapshot = useMemo(
        () => buildEditorSnapshot(settings, page, sections),
        [settings, page, sections]
    );

    const globalSettingsQualification = useMemo(
        () => getWebsiteGlobalSettingsQualification(settings),
        [settings]
    );

    const pageTemplates = useMemo(
        () => getWebsiteSectionTemplatesForPage(selectedPageSlug),
        [selectedPageSlug]
    );

    const academicsTemplateCards = useMemo(
        () =>
            sanitizeAcademicsCards(
                (pageTemplates.find((section) => section.key === "academics_hero")?.content.academics_cards || []) as AcademicsShowcaseCardItem[]
            ),
        [pageTemplates]
    );

    const selectedThemePresetId = useMemo(() => {
        const matchedPreset = WEBSITE_COLOR_THEME_PRESETS.find(
            (preset) =>
                preset.primary.toLowerCase() === settings.primary_color.trim().toLowerCase() &&
                preset.secondary.toLowerCase() === settings.secondary_color.trim().toLowerCase()
        );

        return matchedPreset?.id || "custom";
    }, [settings.primary_color, settings.secondary_color]);

    const sectionCustomizationMap = useMemo(() => {
        const map: Record<string, boolean> = {};
        editableSections.forEach((section) => {
            map[section.id] = isWebsiteSectionCustomized(section.section_key, section.content, selectedPageSlug);
        });
        return map;
    }, [editableSections, selectedPageSlug]);

    const sectionsNeedingCustomization = useMemo(
        () => editableSections.filter((section) => !sectionCustomizationMap[section.id]),
        [editableSections, sectionCustomizationMap]
    );

    const totalPublishChecklistItems = editableSections.length + 1;
    const completedPublishChecklistItems =
        editableSections.filter((section) => sectionCustomizationMap[section.id]).length +
        (globalSettingsQualification.ready ? 1 : 0);
    const publishProgressPercent =
        totalPublishChecklistItems === 0
            ? 0
            : Math.min(100, Math.round((completedPublishChecklistItems / totalPublishChecklistItems) * 100));
    const canPublishSite =
        sectionsNeedingCustomization.length === 0 && globalSettingsQualification.ready;

    const usesStrictPublishChecklist = selectedPageSlug === "home";

    const activePageLabel =
        PAGE_OPTIONS.find((option) => option.slug === selectedPageSlug)?.label || "Homepage";

    const hasUnsavedChanges = Boolean(lastSavedSnapshot) && currentSnapshot !== lastSavedSnapshot;

    async function loadWebsiteBuilder() {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/website/pages/${selectedPageSlug}`, { cache: "no-store" });
            const payload = await res.json();

            if (!res.ok || !payload.success) {
                throw new Error(payload.error || "Failed to load Website Builder");
            }

            setSettings(payload.data.settings || DEFAULT_SETTINGS);
            setPage(payload.data.page || null);
            setSections(payload.data.sections || []);
            setMedia(payload.data.media || []);
            setSchool(payload.data.school || null);
            setLastSavedSnapshot(
                buildEditorSnapshot(
                    payload.data.settings || DEFAULT_SETTINGS,
                    payload.data.page || null,
                    payload.data.sections || []
                )
            );
        } catch (error: any) {
            toast.error(error.message || "Unable to load Website Builder");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadWebsiteBuilder();
    }, [selectedPageSlug]);

    useEffect(() => {
        if (activeEditorTab === "settings") return;
        const tabExists = editableSections.some((section) => `section-${section.id}` === activeEditorTab);
        if (!tabExists) {
            setActiveEditorTab("settings");
        }
    }, [activeEditorTab, editableSections]);

    useEffect(() => {
        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            if (!hasUnsavedChanges) return;
            event.preventDefault();
            event.returnValue = "";
        };

        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);
        };
    }, [hasUnsavedChanges]);

    useEffect(() => {
        const handleDocumentClick = (event: MouseEvent) => {
            if (!hasUnsavedChanges) return;

            const target = event.target as HTMLElement | null;
            const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
            if (!anchor) return;
            if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;

            const href = anchor.getAttribute("href") || "";
            if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;

            const nextUrl = new URL(anchor.href, window.location.href);
            const currentUrl = new URL(window.location.href);
            const sameLocation =
                nextUrl.pathname === currentUrl.pathname &&
                nextUrl.search === currentUrl.search &&
                nextUrl.hash === currentUrl.hash;

            if (sameLocation) return;

            const shouldLeave = window.confirm("You have unsaved changes. Leave this page without saving?");
            if (!shouldLeave) {
                event.preventDefault();
                event.stopPropagation();
            }
        };

        document.addEventListener("click", handleDocumentClick, true);
        return () => {
            document.removeEventListener("click", handleDocumentClick, true);
        };
    }, [hasUnsavedChanges]);

    function updateSectionContent(
        sectionId: string,
        field: string,
        value: string | string[] | ProgramItem[] | AcademicsShowcaseCardItem[]
    ) {
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

    function getProgramItems(section: SectionData) {
        const fromStructured = (section.content.program_items || [])
            .map((item) => ({
                title: (item.title || "").trim(),
                description: (item.description || "").trim(),
                icon: (item.icon || "📘").trim() || "📘",
                image_url: (item.image_url || "").trim(),
            }))
            .filter((item) => item.title);

        if (fromStructured.length > 0) {
            return fromStructured;
        }

        const fromLegacy = (section.content.items || []).map((item) => item.trim()).filter(Boolean);
        if (fromLegacy.length > 0) {
            return fromLegacy.map((title, index) => {
                const matched = DEFAULT_PROGRAM_ITEMS.find(
                    (fallback) => fallback.title.toLowerCase() === title.toLowerCase()
                );
                const fallback = matched || DEFAULT_PROGRAM_ITEMS[index];
                return {
                    title,
                    description: fallback?.description || "",
                    icon: fallback?.icon || "📘",
                    image_url: "",
                };
            });
        }

        return DEFAULT_PROGRAM_ITEMS.map((item) => ({ ...item }));
    }

    function setProgramItems(sectionId: string, programItems: ProgramItem[]) {
        const sanitized = programItems.map((item) => ({
            title: (item.title || "").trim(),
            description: (item.description || "").trim(),
            icon: (item.icon || "📘").trim() || "📘",
            image_url: (item.image_url || "").trim(),
        }));

        setSections((prev) =>
            prev.map((section) =>
                section.id === sectionId
                    ? {
                        ...section,
                        content: {
                            ...section.content,
                            program_items: sanitized,
                            items: sanitized.map((item) => item.title).filter(Boolean),
                        },
                    }
                    : section
            )
        );
    }

    function addProgramItem(sectionId: string) {
        const target = sections.find((section) => section.id === sectionId);
        if (!target) return;
        const next = [...getProgramItems(target), { title: "", description: "", icon: "📘", image_url: "" }];
        setProgramItems(sectionId, next);
    }

    function updateProgramItem(sectionId: string, index: number, field: keyof ProgramItem, value: string) {
        const target = sections.find((section) => section.id === sectionId);
        if (!target) return;

        const next = getProgramItems(target).map((item, itemIndex) =>
            itemIndex === index
                ? {
                    ...item,
                    [field]: value,
                }
                : item
        );

        setProgramItems(sectionId, next);
    }

    function removeProgramItem(sectionId: string, index: number) {
        const target = sections.find((section) => section.id === sectionId);
        if (!target) return;
        const next = getProgramItems(target).filter((_, itemIndex) => itemIndex !== index);
        setProgramItems(sectionId, next);
    }

    function getFacilityItems(section: SectionData) {
        const fromStructured = (section.content.facility_items || [])
            .map((item) => ({
                title: (item.title || "").trim(),
                description: (item.description || "").trim(),
                icon: (item.icon || "🏢").trim() || "🏢",
                image_url: (item.image_url || "").trim(),
            }))
            .filter((item) => item.title);

        if (fromStructured.length > 0) {
            return fromStructured;
        }

        const fromLegacy = (section.content.items || []).map((item) => item.trim()).filter(Boolean);
        if (fromLegacy.length > 0) {
            return fromLegacy.map((title, index) => {
                const matched = DEFAULT_FACILITY_ITEMS.find(
                    (fallback) => fallback.title.toLowerCase() === title.toLowerCase()
                );
                const fallback = matched || DEFAULT_FACILITY_ITEMS[index];
                return {
                    title,
                    description: fallback?.description || "",
                    icon: fallback?.icon || "🏢",
                    image_url: "",
                };
            });
        }

        return DEFAULT_FACILITY_ITEMS.map((item) => ({ ...item }));
    }

    function setFacilityItems(sectionId: string, facilityItems: FacilityItem[]) {
        const sanitized = facilityItems.map((item) => ({
            title: (item.title || "").trim(),
            description: (item.description || "").trim(),
            icon: (item.icon || "🏢").trim() || "🏢",
            image_url: (item.image_url || "").trim(),
        }));

        setSections((prev) =>
            prev.map((section) =>
                section.id === sectionId
                    ? {
                        ...section,
                        content: {
                            ...section.content,
                            facility_items: sanitized,
                            items: sanitized.map((item) => item.title).filter(Boolean),
                        },
                    }
                    : section
            )
        );
    }

    function addFacilityItem(sectionId: string) {
        const target = sections.find((section) => section.id === sectionId);
        if (!target) return;
        const next = [...getFacilityItems(target), { title: "", description: "", icon: "🏢", image_url: "" }];
        setFacilityItems(sectionId, next);
    }

    function updateFacilityItem(sectionId: string, index: number, field: keyof FacilityItem, value: string) {
        const target = sections.find((section) => section.id === sectionId);
        if (!target) return;

        const next = getFacilityItems(target).map((item, itemIndex) =>
            itemIndex === index
                ? {
                    ...item,
                    [field]: value,
                }
                : item
        );

        setFacilityItems(sectionId, next);
    }

    function removeFacilityItem(sectionId: string, index: number) {
        const target = sections.find((section) => section.id === sectionId);
        if (!target) return;
        const next = getFacilityItems(target).filter((_, itemIndex) => itemIndex !== index);
        setFacilityItems(sectionId, next);
    }

    // Faculty Items CRUD
    function getFacultyItems(section: SectionData) {
        const fromStructured = (section.content.faculty_items || [])
            .map((item) => ({
                title: (item.title || "").trim(),
                position: (item.position || "").trim(),
                description: (item.description || "").trim(),
                image_url: (item.image_url || "").trim(),
            }))
            .filter((item) => item.title);

        if (fromStructured.length > 0) {
            return fromStructured;
        }

        if (section.section_key === "hall_of_fame") {
            const templateItems = (pageTemplates.find((item) => item.key === "hall_of_fame")?.content.faculty_items || []).map((item) => ({
                title: item.title || "",
                position: item.position || "",
                description: item.description || "",
                image_url: item.image_url || "",
            }));
            if (templateItems.length > 0) {
                return templateItems;
            }
        }

        return DEFAULT_FACULTY_ITEMS.map((item) => ({ ...item }));
    }

    function setFacultyItems(sectionId: string, facultyItems: FacultyItem[]) {
        const sanitized = facultyItems.map((item) => ({
            title: (item.title || "").trim(),
            position: (item.position || "").trim(),
            description: (item.description || "").trim(),
            image_url: (item.image_url || "").trim(),
        }));

        setSections((prev) =>
            prev.map((section) =>
                section.id === sectionId
                    ? {
                        ...section,
                        content: {
                            ...section.content,
                            faculty_items: sanitized,
                        },
                    }
                    : section
            )
        );
    }

    function addFacultyItem(sectionId: string) {
        const target = sections.find((section) => section.id === sectionId);
        if (!target) return;
        const next = [...getFacultyItems(target), { title: "", position: "", description: "", image_url: "" }];
        setFacultyItems(sectionId, next);
    }

    function updateFacultyItem(sectionId: string, index: number, field: keyof FacultyItem, value: string) {
        const target = sections.find((section) => section.id === sectionId);
        if (!target) return;

        const next = getFacultyItems(target).map((item, itemIndex) =>
            itemIndex === index
                ? {
                    ...item,
                    [field]: value,
                }
                : item
        );

        setFacultyItems(sectionId, next);
    }

    function removeFacultyItem(sectionId: string, index: number) {
        const target = sections.find((section) => section.id === sectionId);
        if (!target) return;
        const next = getFacultyItems(target).filter((_, itemIndex) => itemIndex !== index);
        setFacultyItems(sectionId, next);
    }

    // News Items CRUD
    function getNewsItems(section: SectionData) {
        const fromStructured = (section.content.news_items || [])
            .map((item) => ({
                title: (item.title || "").trim(),
                description: (item.description || "").trim(),
            }))
            .filter((item) => item.title);

        if (fromStructured.length > 0) {
            return fromStructured;
        }

        if (section.section_key === "achievements_awards") {
            const templateItems = (pageTemplates.find((item) => item.key === "achievements_awards")?.content.news_items || []).map((item) => ({
                title: item.title || "",
                description: item.description || "",
            }));
            if (templateItems.length > 0) {
                return templateItems;
            }
        }

        return DEFAULT_NEWS_ITEMS.map((item) => ({ ...item }));
    }

    function setNewsItems(sectionId: string, newsItems: NewsItem[]) {
        const sanitized = newsItems.map((item) => ({
            title: (item.title || "").trim(),
            description: (item.description || "").trim(),
        }));

        setSections((prev) =>
            prev.map((section) =>
                section.id === sectionId
                    ? {
                        ...section,
                        content: {
                            ...section.content,
                            news_items: sanitized,
                        },
                    }
                    : section
            )
        );
    }

    function addNewsItem(sectionId: string) {
        const target = sections.find((section) => section.id === sectionId);
        if (!target) return;
        const next = [...getNewsItems(target), { title: "", description: "" }];
        setNewsItems(sectionId, next);
    }

    function updateNewsItem(sectionId: string, index: number, field: keyof NewsItem, value: string) {
        const target = sections.find((section) => section.id === sectionId);
        if (!target) return;

        const next = getNewsItems(target).map((item, itemIndex) =>
            itemIndex === index
                ? {
                    ...item,
                    [field]: value,
                }
                : item
        );

        setNewsItems(sectionId, next);
    }

    function removeNewsItem(sectionId: string, index: number) {
        const target = sections.find((section) => section.id === sectionId);
        if (!target) return;
        const next = getNewsItems(target).filter((_, itemIndex) => itemIndex !== index);
        setNewsItems(sectionId, next);
    }

    // Testimonial Items CRUD
    function getTestimonialItems(section: SectionData) {
        const fromStructured = (section.content.testimonial_items || [])
            .map((item) => ({
                text: (item.text || "").trim(),
                author: (item.author || "").trim(),
                role: (item.role || "").trim(),
            }))
            .filter((item) => item.text && item.author);

        if (fromStructured.length > 0) {
            return fromStructured;
        }

        return DEFAULT_TESTIMONIAL_ITEMS.map((item) => ({ ...item }));
    }

    function setTestimonialItems(sectionId: string, testimonialItems: TestimonialItem[]) {
        const sanitized = testimonialItems.map((item) => ({
            text: (item.text || "").trim(),
            author: (item.author || "").trim(),
            role: (item.role || "").trim(),
        }));

        setSections((prev) =>
            prev.map((section) =>
                section.id === sectionId
                    ? {
                        ...section,
                        content: {
                            ...section.content,
                            testimonial_items: sanitized,
                        },
                    }
                    : section
            )
        );
    }

    function addTestimonialItem(sectionId: string) {
        const target = sections.find((section) => section.id === sectionId);
        if (!target) return;
        const next = [...getTestimonialItems(target), { text: "", author: "", role: "" }];
        setTestimonialItems(sectionId, next);
    }

    function updateTestimonialItem(sectionId: string, index: number, field: keyof TestimonialItem, value: string) {
        const target = sections.find((section) => section.id === sectionId);
        if (!target) return;

        const next = getTestimonialItems(target).map((item, itemIndex) =>
            itemIndex === index
                ? {
                    ...item,
                    [field]: value,
                }
                : item
        );

        setTestimonialItems(sectionId, next);
    }

    function removeTestimonialItem(sectionId: string, index: number) {
        const target = sections.find((section) => section.id === sectionId);
        if (!target) return;
        const next = getTestimonialItems(target).filter((_, itemIndex) => itemIndex !== index);
        setTestimonialItems(sectionId, next);
    }

    // Gallery Items CRUD
    function getGalleryItems(section: SectionData) {
        const fromStructured = (section.content.gallery_items || [])
            .map((item) => ({
                image_url: (item.image_url || "").trim(),
                caption: (item.caption || "").trim(),
            }))
            .filter((item) => item.image_url);

        if (fromStructured.length > 0) {
            return fromStructured;
        }

        return DEFAULT_GALLERY_ITEMS.map((item) => ({ ...item }));
    }

    function getAcademicsCards(section: SectionData) {
        const fromStructured = sanitizeAcademicsCards(section.content.academics_cards || []);

        if (fromStructured.length > 0) {
            return fromStructured;
        }

        return academicsTemplateCards.map((card) => ({ ...card }));
    }

    function setAcademicsCards(sectionId: string, cards: AcademicsShowcaseCardItem[]) {
        const sanitized = sanitizeAcademicsCards(cards);

        setSections((prev) =>
            prev.map((section) =>
                section.id === sectionId
                    ? {
                        ...section,
                        content: {
                            ...section.content,
                            academics_cards: sanitized,
                        },
                    }
                    : section
            )
        );
    }

    function addAcademicsCard(sectionId: string) {
        const target = sections.find((section) => section.id === sectionId);
        if (!target) return;
        const next = [...getAcademicsCards(target), { image_url: "", sample_subjects: [] }];
        setAcademicsCards(sectionId, next);
    }

    function updateAcademicsCard(sectionId: string, index: number, field: keyof AcademicsShowcaseCardItem, value: string) {
        const target = sections.find((section) => section.id === sectionId);
        if (!target) return;

        const next = getAcademicsCards(target).map((card, cardIndex) =>
            cardIndex === index
                ? {
                    ...card,
                    [field]: field === "sample_subjects" ? normalizeAcademicsCardSubjects(value) : value,
                }
                : card
        ) as AcademicsShowcaseCardItem[];

        setAcademicsCards(sectionId, next);
    }

    function removeAcademicsCard(sectionId: string, index: number) {
        const target = sections.find((section) => section.id === sectionId);
        if (!target) return;
        const next = getAcademicsCards(target).filter((_, cardIndex) => cardIndex !== index);
        setAcademicsCards(sectionId, next);
    }

    function getAdmissionRequirements(section: SectionData) {
        const structured = (section.content.admissions_requirements || [])
            .map((item) => item.trim())
            .filter(Boolean);

        if (structured.length > 0) {
            return structured;
        }

        const fromLegacy = (section.content.items || []).map((item) => item.trim()).filter(Boolean);
        if (fromLegacy.length > 0) {
            return fromLegacy;
        }

        const template = pageTemplates.find((item) => item.key === "admissions")?.content;
        return (template?.admissions_requirements || []).map((item) => item.trim()).filter(Boolean);
    }

    function setAdmissionRequirements(sectionId: string, requirements: string[]) {
        const sanitized = requirements.map((item) => item.trim()).filter(Boolean);

        setSections((prev) =>
            prev.map((section) =>
                section.id === sectionId
                    ? {
                        ...section,
                        content: {
                            ...section.content,
                            admissions_requirements: sanitized,
                            items: sanitized,
                        },
                    }
                    : section
            )
        );
    }

    function getAdmissionSteps(section: SectionData) {
        const structured = (section.content.admissions_steps || [])
            .map((item) => item.trim())
            .filter(Boolean);

        if (structured.length > 0) {
            return structured;
        }

        const template = pageTemplates.find((item) => item.key === "admissions")?.content;
        return (template?.admissions_steps || []).map((item) => item.trim()).filter(Boolean);
    }

    function setAdmissionSteps(sectionId: string, steps: string[]) {
        const sanitized = steps.map((item) => item.trim()).filter(Boolean);

        setSections((prev) =>
            prev.map((section) =>
                section.id === sectionId
                    ? {
                        ...section,
                        content: {
                            ...section.content,
                            admissions_steps: sanitized,
                        },
                    }
                    : section
            )
        );
    }

    function getContactLines(section: SectionData, field: "contact_address_lines" | "contact_phone_lines" | "contact_email_lines" | "contact_hours_lines") {
        const structured = (section.content[field] || [])
            .map((item) => item.trim())
            .filter(Boolean);

        if (structured.length > 0) {
            return structured;
        }

        const template = pageTemplates.find((item) => item.key === "contact")?.content;
        const templateLines = (template?.[field] || []) as string[];
        if (templateLines.length > 0) {
            return templateLines.map((item) => item.trim()).filter(Boolean);
        }

        return [];
    }

    function setContactLines(
        sectionId: string,
        field: "contact_address_lines" | "contact_phone_lines" | "contact_email_lines" | "contact_hours_lines",
        values: string[]
    ) {
        const sanitized = values.map((item) => item.trim()).filter(Boolean);

        setSections((prev) =>
            prev.map((section) =>
                section.id === sectionId
                    ? {
                        ...section,
                        content: {
                            ...section.content,
                            [field]: sanitized,
                        },
                    }
                    : section
            )
        );
    }

    function setGalleryItems(sectionId: string, galleryItems: GalleryItem[]) {
        const sanitized = galleryItems.map((item) => ({
            image_url: (item.image_url || "").trim(),
            caption: (item.caption || "").trim(),
        }));

        setSections((prev) =>
            prev.map((section) =>
                section.id === sectionId
                    ? {
                        ...section,
                        content: {
                            ...section.content,
                            gallery_items: sanitized,
                        },
                    }
                    : section
            )
        );
    }

    function addGalleryItem(sectionId: string) {
        const target = sections.find((section) => section.id === sectionId);
        if (!target) return;
        const next = [...getGalleryItems(target), { image_url: "", caption: "" }];
        setGalleryItems(sectionId, next);
    }

    function updateGalleryItem(sectionId: string, index: number, field: keyof GalleryItem, value: string) {
        const target = sections.find((section) => section.id === sectionId);
        if (!target) return;

        const next = getGalleryItems(target).map((item, itemIndex) =>
            itemIndex === index
                ? {
                    ...item,
                    [field]: value,
                }
                : item
        );

        setGalleryItems(sectionId, next);
    }

    function removeGalleryItem(sectionId: string, index: number) {
        const target = sections.find((section) => section.id === sectionId);
        if (!target) return;
        const next = getGalleryItems(target).filter((_, itemIndex) => itemIndex !== index);
        setGalleryItems(sectionId, next);
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

        if (page.status === "published" && usesStrictPublishChecklist && !canPublishSite) {
            const sectionList = sectionsNeedingCustomization.map((section) => section.section_label || section.section_key).join(", ");
            const settingsList = globalSettingsQualification.missingLabels.join(", ");
            toast.error(
                [
                    "Publishing is locked until all sections and global settings are completed.",
                    sectionList ? `Sections: ${sectionList}.` : "",
                    settingsList ? `Global settings: ${settingsList}.` : "",
                ]
                    .filter(Boolean)
                    .join(" ")
            );
            return;
        }

        setSaving(true);
        try {
            const sectionPayload = sections.map((section) => ({
                id: section.id,
                section_label: section.section_label,
                is_visible: section.is_visible,
                order_sequence: section.order_sequence,
                content: section.content,
            }));

            const res = await fetch(`/api/admin/website/pages/${selectedPageSlug}`, {
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

    async function saveSection(sectionId: string) {
        const section = sections.find((item) => item.id === sectionId);
        if (!section) return;

        setSavingSectionId(sectionId);
        try {
            const res = await fetch(`/api/admin/website/pages/${selectedPageSlug}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sections: [
                        {
                            id: section.id,
                            section_label: section.section_label,
                            is_visible: section.is_visible,
                            order_sequence: section.order_sequence,
                            content: section.content,
                        },
                    ],
                }),
            });

            const payload = await res.json();
            if (!res.ok || !payload.success) {
                throw new Error(payload.error || "Failed to save section");
            }

            toast.success(`${section.section_label || section.section_key} saved`);
            await loadWebsiteBuilder();
        } catch (error: any) {
            toast.error(error.message || "Section save failed");
        } finally {
            setSavingSectionId(null);
        }
    }

    async function uploadMedia(file: File, displayName?: string) {
        if (!page) return null;

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

            const uploadedUrl = payload.fileUrl as string;

            setMedia((prev) => {
                const nextItem: MediaData = {
                    id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    file_name: displayName?.trim() || file.name,
                    public_url: uploadedUrl,
                    mime_type: file.type || undefined,
                    created_at: new Date().toISOString(),
                    page_id: page.id,
                };

                const withoutDuplicate = prev.filter((item) => item.public_url !== uploadedUrl);
                return [nextItem, ...withoutDuplicate];
            });

            toast.success("Media uploaded successfully");
            setUploadDisplayName("");
            return uploadedUrl;
        } catch (error: any) {
            toast.error(error.message || "Unable to upload media");
            return null;
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

    function resetToTemplateDefaults() {
        setSections((prev) =>
            prev.map((section) => {
                const template = pageTemplates.find((item) => item.key === section.section_key);
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

        const pagePath = selectedPageSlug === "home" ? "" : `/${selectedPageSlug}`;
        return `${window.location.origin}/site/${school.subdomain}${pagePath}`;
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

    function applyThemePreset(presetId: string) {
        if (presetId === "custom") return;

        const preset = WEBSITE_COLOR_THEME_PRESETS.find((item) => item.id === presetId);
        if (!preset) return;

        setSettings((prev) => ({
            ...prev,
            primary_color: preset.primary,
            secondary_color: preset.secondary,
        }));
    }

    function handleMarkPublished() {
        if (usesStrictPublishChecklist && !canPublishSite) {
            const sectionList = sectionsNeedingCustomization.map((section) => section.section_label || section.section_key).join(", ");
            const settingsList = globalSettingsQualification.missingLabels.join(", ");
            toast.error(
                [
                    "Publishing is locked. Finish customization first.",
                    sectionList ? `Sections: ${sectionList}.` : "",
                    settingsList ? `Global settings: ${settingsList}.` : "",
                ]
                    .filter(Boolean)
                    .join(" ")
            );
            return;
        }

        setPage((prev) => (prev ? { ...prev, status: "published" } : prev));
    }

    return (
        <DashboardLayout role="admin">
            <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Website Builder</h1>
                        <p className="text-sm text-slate-600">
                            Edit your school website pages, upload media assets, and publish with page-specific controls.
                        </p>
                        <div className="mt-2 max-w-xs">
                            <Label className="text-xs text-slate-600">Editing Page</Label>
                            <Select
                                value={selectedPageSlug}
                                onValueChange={(value) => {
                                    setSelectedPageSlug(value as WebsitePageSlug);
                                    setActiveEditorTab("settings");
                                }}
                            >
                                <SelectTrigger className="mt-1 h-9">
                                    <SelectValue placeholder="Select a page" />
                                </SelectTrigger>
                                <SelectContent>
                                    {PAGE_OPTIONS.map((option) => (
                                        <SelectItem key={option.slug} value={option.slug}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        {school?.subdomain ? (
                            <p className="mt-1 text-xs text-slate-500">Draft preview URL: {getPublicUrl()}</p>
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
                                            <h2 className="text-lg font-semibold text-slate-900">{activePageLabel} Editor</h2>
                                            <p className="text-xs text-slate-500">Edit one segment at a time to stay focused.</p>
                                        </div>
                                        <div className="text-xs text-slate-500">Reorder with arrows, then save</div>
                                    </div>

                                    <Tabs value={activeEditorTab} onValueChange={setActiveEditorTab} className="space-y-4">
                                        <div className="rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-2 shadow-sm">
                                            <TabsList className="h-auto w-full justify-start gap-2 overflow-x-auto bg-transparent p-1">
                                                <TabsTrigger
                                                    value="settings"
                                                    className="h-10 whitespace-nowrap rounded-full border border-transparent px-4 text-sm font-medium text-slate-600 transition-all data-[state=active]:border-slate-300 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm"
                                                >
                                                    Global Settings
                                                </TabsTrigger>
                                                {editableSections.map((section, index) => (
                                                    <TabsTrigger
                                                        key={section.id}
                                                        value={`section-${section.id}`}
                                                        className="h-10 whitespace-nowrap rounded-full border border-transparent px-4 text-sm font-medium text-slate-600 transition-all data-[state=active]:border-slate-300 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm"
                                                    >
                                                        <span className="mr-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-200 px-1.5 text-[11px] font-semibold text-slate-600">
                                                            {index + 1}
                                                        </span>
                                                        <span>{section.section_label || section.section_key}</span>
                                                        {sectionCustomizationMap[section.id] ? (
                                                            <CheckCircle2 className="ml-2 h-3.5 w-3.5 text-emerald-600" />
                                                        ) : (
                                                            <AlertTriangle className="ml-2 h-3.5 w-3.5 text-amber-500" />
                                                        )}
                                                    </TabsTrigger>
                                                ))}
                                            </TabsList>
                                            <div className="mt-2 flex items-center justify-between px-1 text-[11px] text-slate-500">
                                                <span>{sortedSections.length} editable sections</span>
                                                <span>Scroll to view all tabs</span>
                                            </div>
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
                                                <div className="space-y-2 md:col-span-2">
                                                    <Label>Color Theme (Required)</Label>
                                                    <Select value={selectedThemePresetId} onValueChange={applyThemePreset}>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select a color theme" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {WEBSITE_COLOR_THEME_PRESETS.map((preset) => (
                                                                <SelectItem key={preset.id} value={preset.id}>
                                                                    {preset.name}
                                                                </SelectItem>
                                                            ))}
                                                            <SelectItem value="custom">Custom (manual colors)</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <div className="flex flex-wrap items-center gap-2 pt-1">
                                                        {WEBSITE_COLOR_THEME_PRESETS.map((preset) => {
                                                            const isSelected = preset.id === selectedThemePresetId;
                                                            return (
                                                                <button
                                                                    key={`swatch-${preset.id}`}
                                                                    type="button"
                                                                    onClick={() => applyThemePreset(preset.id)}
                                                                    className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs transition ${
                                                                        isSelected
                                                                            ? "border-slate-900 bg-slate-50 text-slate-900"
                                                                            : "border-slate-200 text-slate-600 hover:border-slate-300"
                                                                    }`}
                                                                    title={preset.name}
                                                                >
                                                                    <span
                                                                        className="h-3 w-3 rounded-full border border-white/70 shadow-sm"
                                                                        style={{ backgroundColor: preset.primary }}
                                                                    />
                                                                    <span
                                                                        className="h-3 w-3 rounded-full border border-white/70 shadow-sm"
                                                                        style={{ backgroundColor: preset.secondary }}
                                                                    />
                                                                    <span>{preset.name}</span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Primary Color</Label>
                                                    <Input
                                                        placeholder="#1e3a8a"
                                                        value={settings.primary_color}
                                                        onChange={(e) => setSettings((prev) => ({ ...prev, primary_color: e.target.value }))}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Secondary Color</Label>
                                                    <Input
                                                        placeholder="#059669"
                                                        value={settings.secondary_color}
                                                        onChange={(e) => setSettings((prev) => ({ ...prev, secondary_color: e.target.value }))}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Logo URL (Required)</Label>
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

                                        {editableSections.map((section) => {
                                            const editorConfig =
                                                SECTION_EDITOR_CONFIG[section.section_key] || SECTION_EDITOR_CONFIG.contact;
                                            const programItems = section.section_key === "programs" ? getProgramItems(section) : [];

                                            const facilityItems = section.section_key === "facilities" ? getFacilityItems(section) : [];
                                            const academicsCards = section.section_key === "academics_hero" ? getAcademicsCards(section) : [];

                                            return (
                                                <TabsContent key={section.id} value={`section-${section.id}`} className="space-y-3">
                                                    <div className="rounded-lg border bg-white p-4">
                                                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                                            <div className="flex items-center gap-2">
                                                                <Badge variant="outline">{section.section_key}</Badge>
                                                                {sectionCustomizationMap[section.id] ? (
                                                                    <Badge className="bg-emerald-600">Customized</Badge>
                                                                ) : (
                                                                    <Badge variant="outline" className="border-amber-300 text-amber-700">
                                                                        Needs Editing
                                                                    </Badge>
                                                                )}
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
                                                                <Button
                                                                    type="button"
                                                                    size="sm"
                                                                    onClick={() => saveSection(section.id)}
                                                                    disabled={savingSectionId === section.id || loading || saving}
                                                                >
                                                                    {savingSectionId === section.id ? (
                                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                    ) : (
                                                                        <Save className="mr-2 h-4 w-4" />
                                                                    )}
                                                                    Save Section
                                                                </Button>
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

                                                            {section.section_key === "facilities" ? (
                                                                <div className="space-y-3 md:col-span-2">
                                                                    <div className="flex items-center justify-between gap-2">
                                                                        <Label>Facility Cards</Label>
                                                                        <Button
                                                                            type="button"
                                                                            variant="outline"
                                                                            size="sm"
                                                                            onClick={() => addFacilityItem(section.id)}
                                                                        >
                                                                            <Plus className="mr-2 h-4 w-4" />
                                                                            Add Facility
                                                                        </Button>
                                                                    </div>

                                                                    <div className="space-y-3">
                                                                        {facilityItems.map((facility, index) => {
                                                                            const mediaKey = `${section.id}-facility-${index}`;
                                                                            return (
                                                                                <div key={mediaKey} className="rounded-lg border border-slate-200 p-3">
                                                                                    <div className="mb-3 flex items-center justify-between">
                                                                                        <p className="text-sm font-semibold text-slate-800">Facility {index + 1}</p>
                                                                                        <Button
                                                                                            type="button"
                                                                                            variant="ghost"
                                                                                            size="sm"
                                                                                            onClick={() => removeFacilityItem(section.id, index)}
                                                                                        >
                                                                                            <Trash2 className="mr-1 h-4 w-4" />
                                                                                            Remove
                                                                                        </Button>
                                                                                    </div>

                                                                                    <div className="grid gap-3 md:grid-cols-2">
                                                                                        <div className="space-y-1">
                                                                                            <Label>Title</Label>
                                                                                            <Input
                                                                                                value={facility.title}
                                                                                                onChange={(e) =>
                                                                                                    updateFacilityItem(section.id, index, "title", e.target.value)
                                                                                                }
                                                                                            />
                                                                                        </div>
                                                                                        <div className="space-y-1">
                                                                                            <Label>Emoji Fallback</Label>
                                                                                            <Input
                                                                                                value={facility.icon || ""}
                                                                                                onChange={(e) =>
                                                                                                    updateFacilityItem(section.id, index, "icon", e.target.value)
                                                                                                }
                                                                                                placeholder="🏢"
                                                                                            />
                                                                                        </div>
                                                                                        <div className="space-y-1 md:col-span-2">
                                                                                            <Label>Description</Label>
                                                                                            <Textarea
                                                                                                rows={2}
                                                                                                value={facility.description}
                                                                                                onChange={(e) =>
                                                                                                    updateFacilityItem(
                                                                                                        section.id,
                                                                                                        index,
                                                                                                        "description",
                                                                                                        e.target.value
                                                                                                    )
                                                                                                }
                                                                                            />
                                                                                        </div>
                                                                                        <div className="space-y-1 md:col-span-2">
                                                                                            <Label>Facility Image URL (optional)</Label>
                                                                                            <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                                                                                                <Input
                                                                                                    value={facility.image_url || ""}
                                                                                                    onChange={(e) =>
                                                                                                        updateFacilityItem(
                                                                                                            section.id,
                                                                                                            index,
                                                                                                            "image_url",
                                                                                                            e.target.value
                                                                                                        )
                                                                                                    }
                                                                                                />
                                                                                                <select
                                                                                                    className="h-10 rounded-md border border-slate-200 px-2 text-sm"
                                                                                                    value={selectedMediaBySection[mediaKey] || ""}
                                                                                                    onChange={(e) => {
                                                                                                        const selectedUrl = e.target.value;
                                                                                                        setSelectedMediaBySection((prev) => ({
                                                                                                            ...prev,
                                                                                                            [mediaKey]: selectedUrl,
                                                                                                        }));
                                                                                                        if (!selectedUrl) return;
                                                                                                        updateFacilityItem(section.id, index, "image_url", selectedUrl);
                                                                                                    }}
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
                                                                                                <label className="inline-flex cursor-pointer items-center">
                                                                                                    <input
                                                                                                        type="file"
                                                                                                        className="hidden"
                                                                                                        accept="image/*"
                                                                                                        onChange={async (e) => {
                                                                                                            const file = e.target.files?.[0];
                                                                                                            if (!file) return;
                                                                                                            const uploadedUrl = await uploadMedia(file);
                                                                                                            if (uploadedUrl) {
                                                                                                                updateFacilityItem(section.id, index, "image_url", uploadedUrl);
                                                                                                                setSelectedMediaBySection((prev) => ({
                                                                                                                    ...prev,
                                                                                                                    [mediaKey]: uploadedUrl,
                                                                                                                }));
                                                                                                            }
                                                                                                            e.currentTarget.value = "";
                                                                                                        }}
                                                                                                    />
                                                                                                    <span className="inline-flex items-center rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">
                                                                                                        {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                                                                                        Upload Image
                                                                                                    </span>
                                                                                                </label>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
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
                                                                            onChange={(e) => {
                                                                                const selectedUrl = e.target.value;
                                                                                setSelectedMediaBySection((prev) => ({
                                                                                    ...prev,
                                                                                    [section.id]: selectedUrl,
                                                                                }));
                                                                                if (!selectedUrl) return;
                                                                                updateSectionContent(section.id, "image_url", selectedUrl);
                                                                            }}
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
                                                                        <label className="inline-flex cursor-pointer items-center">
                                                                            <input
                                                                                type="file"
                                                                                className="hidden"
                                                                                accept="image/*"
                                                                                onChange={async (e) => {
                                                                                    const file = e.target.files?.[0];
                                                                                    if (!file) return;
                                                                                    const uploadedUrl = await uploadMedia(file);
                                                                                    if (uploadedUrl) {
                                                                                        updateSectionContent(section.id, "image_url", uploadedUrl);
                                                                                        setSelectedMediaBySection((prev) => ({
                                                                                            ...prev,
                                                                                            [section.id]: uploadedUrl,
                                                                                        }));
                                                                                    }
                                                                                    e.currentTarget.value = "";
                                                                                }}
                                                                            />
                                                                            <span className="inline-flex items-center rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">
                                                                                {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                                                                Upload Image
                                                                            </span>
                                                                        </label>
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

                                                            {section.section_key === "academics_hero" ? (
                                                                <div className="space-y-3 md:col-span-2">
                                                                    <div className="flex items-start justify-between gap-2">
                                                                        <div>
                                                                            <Label>Academic Showcase Cards</Label>
                                                                            <p className="mt-1 text-xs text-slate-500">
                                                                                Keep cards separated and easy to edit. Card title and class stats still come from the academics database.
                                                                            </p>
                                                                        </div>
                                                                        <Button
                                                                            type="button"
                                                                            variant="outline"
                                                                            size="sm"
                                                                            onClick={() => addAcademicsCard(section.id)}
                                                                        >
                                                                            <Plus className="mr-2 h-4 w-4" />
                                                                            Add Card
                                                                        </Button>
                                                                    </div>

                                                                    <div className="space-y-3">
                                                                        {academicsCards.map((card, index) => {
                                                                            const mediaKey = `${section.id}-academics-${index}`;
                                                                            return (
                                                                                <div key={mediaKey} className="rounded-lg border border-slate-200 p-3">
                                                                                    <div className="mb-3 flex items-center justify-between">
                                                                                        <p className="text-sm font-semibold text-slate-800">Card {index + 1}</p>
                                                                                        <Button
                                                                                            type="button"
                                                                                            variant="ghost"
                                                                                            size="sm"
                                                                                            onClick={() => removeAcademicsCard(section.id, index)}
                                                                                        >
                                                                                            <Trash2 className="mr-1 h-4 w-4" />
                                                                                            Remove
                                                                                        </Button>
                                                                                    </div>

                                                                                    <div className="grid gap-3 md:grid-cols-2">
                                                                                        <div className="space-y-1 md:col-span-2">
                                                                                            <Label>Card Image URL</Label>
                                                                                            <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                                                                                                <Input
                                                                                                    value={card.image_url}
                                                                                                    onChange={(e) =>
                                                                                                        updateAcademicsCard(section.id, index, "image_url", e.target.value)
                                                                                                    }
                                                                                                    placeholder="https://..."
                                                                                                />
                                                                                                <select
                                                                                                    className="h-10 rounded-md border border-slate-200 px-2 text-sm"
                                                                                                    value={selectedMediaBySection[mediaKey] || ""}
                                                                                                    onChange={(e) => {
                                                                                                        const selectedUrl = e.target.value;
                                                                                                        setSelectedMediaBySection((prev) => ({
                                                                                                            ...prev,
                                                                                                            [mediaKey]: selectedUrl,
                                                                                                        }));
                                                                                                        if (!selectedUrl) return;
                                                                                                        updateAcademicsCard(section.id, index, "image_url", selectedUrl);
                                                                                                    }}
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
                                                                                                <label className="inline-flex cursor-pointer items-center">
                                                                                                    <input
                                                                                                        type="file"
                                                                                                        className="hidden"
                                                                                                        accept="image/*"
                                                                                                        onChange={async (e) => {
                                                                                                            const file = e.target.files?.[0];
                                                                                                            if (!file) return;
                                                                                                            const uploadedUrl = await uploadMedia(file);
                                                                                                            if (uploadedUrl) {
                                                                                                                updateAcademicsCard(section.id, index, "image_url", uploadedUrl);
                                                                                                                setSelectedMediaBySection((prev) => ({
                                                                                                                    ...prev,
                                                                                                                    [mediaKey]: uploadedUrl,
                                                                                                                }));
                                                                                                            }
                                                                                                            e.currentTarget.value = "";
                                                                                                        }}
                                                                                                    />
                                                                                                    <span className="inline-flex items-center rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">
                                                                                                        {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                                                                                        Upload Image
                                                                                                    </span>
                                                                                                </label>
                                                                                            </div>
                                                                                        </div>

                                                                                        <div className="space-y-1 md:col-span-2">
                                                                                            <div className="flex items-center justify-between gap-2">
                                                                                                <Label>Sample Subjects</Label>
                                                                                                <span className="text-[11px] text-slate-500">Separate with commas or new lines</span>
                                                                                            </div>
                                                                                            <Textarea
                                                                                                rows={3}
                                                                                                value={card.sample_subjects.join(", ")}
                                                                                                onChange={(e) =>
                                                                                                    updateAcademicsCard(section.id, index, "sample_subjects", e.target.value)
                                                                                                }
                                                                                                placeholder="Mathematics, English, Science"
                                                                                            />
                                                                                            <div className="flex flex-wrap gap-2">
                                                                                                {card.sample_subjects.length > 0 ? (
                                                                                                    card.sample_subjects.map((subject) => (
                                                                                                        <span key={subject} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                                                                                                            {subject}
                                                                                                        </span>
                                                                                                    ))
                                                                                                ) : (
                                                                                                    <span className="text-sm text-slate-500">No subjects added yet.</span>
                                                                                                )}
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
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

                                                            {section.section_key === "programs" ? (
                                                                <div className="space-y-3 md:col-span-2">
                                                                    <div className="flex items-center justify-between gap-2">
                                                                        <Label>Program Cards</Label>
                                                                        <Button
                                                                            type="button"
                                                                            variant="outline"
                                                                            size="sm"
                                                                            onClick={() => addProgramItem(section.id)}
                                                                        >
                                                                            <Plus className="mr-2 h-4 w-4" />
                                                                            Add Program
                                                                        </Button>
                                                                    </div>

                                                                    <div className="space-y-3">
                                                                        {programItems.map((program, index) => {
                                                                            const mediaKey = `${section.id}-program-${index}`;
                                                                            return (
                                                                                <div key={mediaKey} className="rounded-lg border border-slate-200 p-3">
                                                                                    <div className="mb-3 flex items-center justify-between">
                                                                                        <p className="text-sm font-semibold text-slate-800">Program {index + 1}</p>
                                                                                        <Button
                                                                                            type="button"
                                                                                            variant="ghost"
                                                                                            size="sm"
                                                                                            onClick={() => removeProgramItem(section.id, index)}
                                                                                        >
                                                                                            <Trash2 className="mr-1 h-4 w-4" />
                                                                                            Remove
                                                                                        </Button>
                                                                                    </div>

                                                                                    <div className="grid gap-3 md:grid-cols-2">
                                                                                        <div className="space-y-1">
                                                                                            <Label>Title</Label>
                                                                                            <Input
                                                                                                value={program.title}
                                                                                                onChange={(e) =>
                                                                                                    updateProgramItem(section.id, index, "title", e.target.value)
                                                                                                }
                                                                                            />
                                                                                        </div>
                                                                                        <div className="space-y-1">
                                                                                            <Label>Emoji Fallback</Label>
                                                                                            <Input
                                                                                                value={program.icon || ""}
                                                                                                onChange={(e) =>
                                                                                                    updateProgramItem(section.id, index, "icon", e.target.value)
                                                                                                }
                                                                                                placeholder="🔬"
                                                                                            />
                                                                                        </div>
                                                                                        <div className="space-y-1 md:col-span-2">
                                                                                            <Label>Description</Label>
                                                                                            <Textarea
                                                                                                rows={2}
                                                                                                value={program.description}
                                                                                                onChange={(e) =>
                                                                                                    updateProgramItem(
                                                                                                        section.id,
                                                                                                        index,
                                                                                                        "description",
                                                                                                        e.target.value
                                                                                                    )
                                                                                                }
                                                                                            />
                                                                                        </div>
                                                                                        <div className="space-y-1 md:col-span-2">
                                                                                            <Label>Program Image URL (optional)</Label>
                                                                                            <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                                                                                                <Input
                                                                                                    value={program.image_url || ""}
                                                                                                    onChange={(e) =>
                                                                                                        updateProgramItem(
                                                                                                            section.id,
                                                                                                            index,
                                                                                                            "image_url",
                                                                                                            e.target.value
                                                                                                        )
                                                                                                    }
                                                                                                />
                                                                                                <select
                                                                                                    className="h-10 rounded-md border border-slate-200 px-2 text-sm"
                                                                                                    value={selectedMediaBySection[mediaKey] || ""}
                                                                                                    onChange={(e) => {
                                                                                                        const selectedUrl = e.target.value;
                                                                                                        setSelectedMediaBySection((prev) => ({
                                                                                                            ...prev,
                                                                                                            [mediaKey]: selectedUrl,
                                                                                                        }));
                                                                                                        if (!selectedUrl) return;
                                                                                                        updateProgramItem(section.id, index, "image_url", selectedUrl);
                                                                                                    }}
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
                                                                                                <label className="inline-flex cursor-pointer items-center">
                                                                                                    <input
                                                                                                        type="file"
                                                                                                        className="hidden"
                                                                                                        accept="image/*"
                                                                                                        onChange={async (e) => {
                                                                                                            const file = e.target.files?.[0];
                                                                                                            if (!file) return;
                                                                                                            const uploadedUrl = await uploadMedia(file);
                                                                                                            if (uploadedUrl) {
                                                                                                                updateProgramItem(section.id, index, "image_url", uploadedUrl);
                                                                                                                setSelectedMediaBySection((prev) => ({
                                                                                                                    ...prev,
                                                                                                                    [mediaKey]: uploadedUrl,
                                                                                                                }));
                                                                                                            }
                                                                                                            e.currentTarget.value = "";
                                                                                                        }}
                                                                                                    />
                                                                                                    <span className="inline-flex items-center rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">
                                                                                                        {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                                                                                        Upload Image
                                                                                                    </span>
                                                                                                </label>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            ) : null}

                                                            {section.section_key === "faculty" || section.section_key === "hall_of_fame" ? (
                                                                <div className="space-y-3 md:col-span-2">
                                                                    <div className="flex items-center justify-between gap-2">
                                                                        <Label>{section.section_key === "hall_of_fame" ? "Hall Of Fame Cards" : "Faculty Cards"}</Label>
                                                                        <Button
                                                                            type="button"
                                                                            variant="outline"
                                                                            size="sm"
                                                                            onClick={() => addFacultyItem(section.id)}
                                                                        >
                                                                            <Plus className="mr-2 h-4 w-4" />
                                                                            {section.section_key === "hall_of_fame" ? "Add Profile" : "Add Faculty"}
                                                                        </Button>
                                                                    </div>

                                                                    <div className="space-y-3">
                                                                        {getFacultyItems(section).map((faculty, index) => {
                                                                            const mediaKey = `${section.id}-faculty-${index}`;
                                                                            return (
                                                                                <div key={mediaKey} className="rounded-lg border border-slate-200 p-3">
                                                                                    <div className="mb-3 flex items-center justify-between">
                                                                                        <p className="text-sm font-semibold text-slate-800">{section.section_key === "hall_of_fame" ? `Profile ${index + 1}` : `Faculty ${index + 1}`}</p>
                                                                                        <Button
                                                                                            type="button"
                                                                                            variant="ghost"
                                                                                            size="sm"
                                                                                            onClick={() => removeFacultyItem(section.id, index)}
                                                                                        >
                                                                                            <Trash2 className="mr-1 h-4 w-4" />
                                                                                            Remove
                                                                                        </Button>
                                                                                    </div>

                                                                                    <div className="grid gap-3 md:grid-cols-2">
                                                                                        <div className="space-y-1">
                                                                                            <Label>{section.section_key === "hall_of_fame" ? "Name / Team" : "Name"}</Label>
                                                                                            <Input
                                                                                                value={faculty.title}
                                                                                                onChange={(e) =>
                                                                                                    updateFacultyItem(section.id, index, "title", e.target.value)
                                                                                                }
                                                                                                placeholder="Dr. Jane Smith"
                                                                                            />
                                                                                        </div>
                                                                                        <div className="space-y-1">
                                                                                            <Label>Position/Role</Label>
                                                                                            <Input
                                                                                                value={faculty.position || ""}
                                                                                                onChange={(e) =>
                                                                                                    updateFacultyItem(section.id, index, "position", e.target.value)
                                                                                                }
                                                                                                placeholder="Head of Science"
                                                                                            />
                                                                                        </div>
                                                                                        <div className="space-y-1 md:col-span-2">
                                                                                            <Label>{section.section_key === "hall_of_fame" ? "Achievement Summary" : "Bio/Description"}</Label>
                                                                                            <Textarea
                                                                                                rows={2}
                                                                                                value={faculty.description}
                                                                                                onChange={(e) =>
                                                                                                    updateFacultyItem(section.id, index, "description", e.target.value)
                                                                                                }
                                                                                                placeholder="Brief bio or qualifications..."
                                                                                            />
                                                                                        </div>
                                                                                        <div className="space-y-1 md:col-span-2">
                                                                                            <Label>{section.section_key === "hall_of_fame" ? "Profile Image URL" : "Faculty Photo URL"}</Label>
                                                                                            <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                                                                                                <Input
                                                                                                    value={faculty.image_url || ""}
                                                                                                    onChange={(e) =>
                                                                                                        updateFacultyItem(
                                                                                                            section.id,
                                                                                                            index,
                                                                                                            "image_url",
                                                                                                            e.target.value
                                                                                                        )
                                                                                                    }
                                                                                                />
                                                                                                <select
                                                                                                    className="h-10 rounded-md border border-slate-200 px-2 text-sm"
                                                                                                    value={selectedMediaBySection[mediaKey] || ""}
                                                                                                    onChange={(e) => {
                                                                                                        const selectedUrl = e.target.value;
                                                                                                        setSelectedMediaBySection((prev) => ({
                                                                                                            ...prev,
                                                                                                            [mediaKey]: selectedUrl,
                                                                                                        }));
                                                                                                        if (!selectedUrl) return;
                                                                                                        updateFacultyItem(section.id, index, "image_url", selectedUrl);
                                                                                                    }}
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
                                                                                                <label className="inline-flex cursor-pointer items-center">
                                                                                                    <input
                                                                                                        type="file"
                                                                                                        className="hidden"
                                                                                                        accept="image/*"
                                                                                                        onChange={async (e) => {
                                                                                                            const file = e.target.files?.[0];
                                                                                                            if (!file) return;
                                                                                                            const uploadedUrl = await uploadMedia(file);
                                                                                                            if (uploadedUrl) {
                                                                                                                updateFacultyItem(section.id, index, "image_url", uploadedUrl);
                                                                                                                setSelectedMediaBySection((prev) => ({
                                                                                                                    ...prev,
                                                                                                                    [mediaKey]: uploadedUrl,
                                                                                                                }));
                                                                                                            }
                                                                                                            e.currentTarget.value = "";
                                                                                                        }}
                                                                                                    />
                                                                                                    <span className="inline-flex items-center rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">
                                                                                                        {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                                                                                        Upload Image
                                                                                                    </span>
                                                                                                </label>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            ) : null}

                                                            {section.section_key === "news" || section.section_key === "achievements_awards" ? (
                                                                <div className="space-y-3 md:col-span-2">
                                                                    <div className="flex items-center justify-between gap-2">
                                                                        <Label>{section.section_key === "achievements_awards" ? "Awards" : "News Headlines"}</Label>
                                                                        <Button
                                                                            type="button"
                                                                            variant="outline"
                                                                            size="sm"
                                                                            onClick={() => addNewsItem(section.id)}
                                                                        >
                                                                            <Plus className="mr-2 h-4 w-4" />
                                                                            {section.section_key === "achievements_awards" ? "Add Award" : "Add News"}
                                                                        </Button>
                                                                    </div>

                                                                    <div className="space-y-3">
                                                                        {getNewsItems(section).map((newsItem, index) => {
                                                                            return (
                                                                                <div key={`news-${index}`} className="rounded-lg border border-slate-200 p-3">
                                                                                    <div className="mb-3 flex items-center justify-between">
                                                                                        <p className="text-sm font-semibold text-slate-800">{section.section_key === "achievements_awards" ? `Award ${index + 1}` : `News ${index + 1}`}</p>
                                                                                        <Button
                                                                                            type="button"
                                                                                            variant="ghost"
                                                                                            size="sm"
                                                                                            onClick={() => removeNewsItem(section.id, index)}
                                                                                        >
                                                                                            <Trash2 className="mr-1 h-4 w-4" />
                                                                                            Remove
                                                                                        </Button>
                                                                                    </div>

                                                                                    <div className="space-y-3">
                                                                                        <div className="space-y-1">
                                                                                            <Label>{section.section_key === "achievements_awards" ? "Award Title" : "Headline"}</Label>
                                                                                            <Input
                                                                                                value={newsItem.title}
                                                                                                onChange={(e) =>
                                                                                                    updateNewsItem(section.id, index, "title", e.target.value)
                                                                                                }
                                                                                                placeholder={section.section_key === "achievements_awards" ? "Award title..." : "Latest school news..."}
                                                                                            />
                                                                                        </div>
                                                                                        <div className="space-y-1">
                                                                                            <Label>{section.section_key === "achievements_awards" ? "Award Details" : "Description"}</Label>
                                                                                            <Textarea
                                                                                                rows={2}
                                                                                                value={newsItem.description}
                                                                                                onChange={(e) =>
                                                                                                    updateNewsItem(section.id, index, "description", e.target.value)
                                                                                                }
                                                                                                placeholder={section.section_key === "achievements_awards" ? "Award details..." : "News details..."}
                                                                                            />
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            ) : null}

                                                            {section.section_key === "testimonials" ? (
                                                                <div className="space-y-3 md:col-span-2">
                                                                    <div className="flex items-center justify-between gap-2">
                                                                        <Label>What People Say</Label>
                                                                        <Button
                                                                            type="button"
                                                                            variant="outline"
                                                                            size="sm"
                                                                            onClick={() => addTestimonialItem(section.id)}
                                                                        >
                                                                            <Plus className="mr-2 h-4 w-4" />
                                                                            Add Testimonial
                                                                        </Button>
                                                                    </div>

                                                                    <div className="space-y-3">
                                                                        {getTestimonialItems(section).map((testimonial, index) => {
                                                                            return (
                                                                                <div key={`testimonial-${index}`} className="rounded-lg border border-slate-200 p-3">
                                                                                    <div className="mb-3 flex items-center justify-between">
                                                                                        <p className="text-sm font-semibold text-slate-800">Testimonial {index + 1}</p>
                                                                                        <Button
                                                                                            type="button"
                                                                                            variant="ghost"
                                                                                            size="sm"
                                                                                            onClick={() => removeTestimonialItem(section.id, index)}
                                                                                        >
                                                                                            <Trash2 className="mr-1 h-4 w-4" />
                                                                                            Remove
                                                                                        </Button>
                                                                                    </div>

                                                                                    <div className="space-y-3">
                                                                                        <div className="space-y-1">
                                                                                            <Label>Testimonial Text</Label>
                                                                                            <Textarea
                                                                                                rows={2}
                                                                                                value={testimonial.text}
                                                                                                onChange={(e) =>
                                                                                                    updateTestimonialItem(section.id, index, "text", e.target.value)
                                                                                                }
                                                                                                placeholder="What they said..."
                                                                                            />
                                                                                        </div>
                                                                                        <div className="space-y-1">
                                                                                            <Label>Author Name</Label>
                                                                                            <Input
                                                                                                value={testimonial.author}
                                                                                                onChange={(e) =>
                                                                                                    updateTestimonialItem(section.id, index, "author", e.target.value)
                                                                                                }
                                                                                                placeholder="Parent name, student name, etc."
                                                                                            />
                                                                                        </div>
                                                                                        <div className="space-y-1">
                                                                                            <Label>Role/Title (optional)</Label>
                                                                                            <Input
                                                                                                value={testimonial.role || ""}
                                                                                                onChange={(e) =>
                                                                                                    updateTestimonialItem(section.id, index, "role", e.target.value)
                                                                                                }
                                                                                                placeholder="Parent, Grade 5 Student, Alumni, etc."
                                                                                            />
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            ) : null}

                                                            {section.section_key === "gallery" ? (
                                                                <div className="space-y-3 md:col-span-2">
                                                                    <div className="flex items-center justify-between gap-2">
                                                                        <Label>Gallery Items</Label>
                                                                        <Button
                                                                            type="button"
                                                                            variant="outline"
                                                                            size="sm"
                                                                            onClick={() => addGalleryItem(section.id)}
                                                                        >
                                                                            <Plus className="mr-2 h-4 w-4" />
                                                                            Add Image
                                                                        </Button>
                                                                    </div>

                                                                    <div className="space-y-3">
                                                                        {getGalleryItems(section).map((galleryItem, index) => {
                                                                            const mediaKey = `${section.id}-gallery-${index}`;
                                                                            return (
                                                                                <div key={mediaKey} className="rounded-lg border border-slate-200 p-3">
                                                                                    <div className="mb-3 flex items-center justify-between">
                                                                                        <p className="text-sm font-semibold text-slate-800">Image {index + 1}</p>
                                                                                        <Button
                                                                                            type="button"
                                                                                            variant="ghost"
                                                                                            size="sm"
                                                                                            onClick={() => removeGalleryItem(section.id, index)}
                                                                                        >
                                                                                            <Trash2 className="mr-1 h-4 w-4" />
                                                                                            Remove
                                                                                        </Button>
                                                                                    </div>

                                                                                    <div className="space-y-3">
                                                                                        <div className="space-y-1">
                                                                                            <Label>Image URL</Label>
                                                                                            <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                                                                                                <Input
                                                                                                    value={galleryItem.image_url || ""}
                                                                                                    onChange={(e) =>
                                                                                                        updateGalleryItem(
                                                                                                            section.id,
                                                                                                            index,
                                                                                                            "image_url",
                                                                                                            e.target.value
                                                                                                        )
                                                                                                    }
                                                                                                />
                                                                                                <select
                                                                                                    className="h-10 rounded-md border border-slate-200 px-2 text-sm"
                                                                                                    value={selectedMediaBySection[mediaKey] || ""}
                                                                                                    onChange={(e) => {
                                                                                                        const selectedUrl = e.target.value;
                                                                                                        setSelectedMediaBySection((prev) => ({
                                                                                                            ...prev,
                                                                                                            [mediaKey]: selectedUrl,
                                                                                                        }));
                                                                                                        if (!selectedUrl) return;
                                                                                                        updateGalleryItem(section.id, index, "image_url", selectedUrl);
                                                                                                    }}
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
                                                                                                <label className="inline-flex cursor-pointer items-center">
                                                                                                    <input
                                                                                                        type="file"
                                                                                                        className="hidden"
                                                                                                        accept="image/*"
                                                                                                        onChange={async (e) => {
                                                                                                            const file = e.target.files?.[0];
                                                                                                            if (!file) return;
                                                                                                            const uploadedUrl = await uploadMedia(file);
                                                                                                            if (uploadedUrl) {
                                                                                                                updateGalleryItem(section.id, index, "image_url", uploadedUrl);
                                                                                                                setSelectedMediaBySection((prev) => ({
                                                                                                                    ...prev,
                                                                                                                    [mediaKey]: uploadedUrl,
                                                                                                                }));
                                                                                                            }
                                                                                                            e.currentTarget.value = "";
                                                                                                        }}
                                                                                                    />
                                                                                                    <span className="inline-flex items-center rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">
                                                                                                        {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                                                                                        Upload Image
                                                                                                    </span>
                                                                                                </label>
                                                                                            </div>
                                                                                        </div>
                                                                                        <div className="space-y-1">
                                                                                            <Label>Caption (optional)</Label>
                                                                                            <Input
                                                                                                value={galleryItem.caption || ""}
                                                                                                onChange={(e) =>
                                                                                                    updateGalleryItem(section.id, index, "caption", e.target.value)
                                                                                                }
                                                                                                placeholder="Image caption..."
                                                                                            />
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            ) : null}

                                                            {section.section_key === "admissions" ? (
                                                                <>
                                                                    <div className="space-y-1 md:col-span-2">
                                                                        <Label>Admission Requirements (one per line)</Label>
                                                                        <Textarea
                                                                            rows={6}
                                                                            value={getAdmissionRequirements(section).join("\n")}
                                                                            onChange={(e) =>
                                                                                setAdmissionRequirements(
                                                                                    section.id,
                                                                                    e.target.value
                                                                                        .split("\n")
                                                                                        .map((item) => item.trim())
                                                                                        .filter(Boolean)
                                                                                )
                                                                            }
                                                                        />
                                                                    </div>
                                                                    <div className="space-y-1 md:col-span-2">
                                                                        <Label>Admission Process Steps (one per line)</Label>
                                                                        <Textarea
                                                                            rows={6}
                                                                            value={getAdmissionSteps(section).join("\n")}
                                                                            onChange={(e) =>
                                                                                setAdmissionSteps(
                                                                                    section.id,
                                                                                    e.target.value
                                                                                        .split("\n")
                                                                                        .map((item) => item.trim())
                                                                                        .filter(Boolean)
                                                                                )
                                                                            }
                                                                        />
                                                                    </div>
                                                                </>
                                                            ) : null}

                                                            {section.section_key === "contact" ? (
                                                                <>
                                                                    <div className="space-y-1 md:col-span-2">
                                                                        <Label>Contact Intro Message</Label>
                                                                        <Textarea
                                                                            rows={3}
                                                                            value={section.content.description || ""}
                                                                            onChange={(e) =>
                                                                                updateSectionContent(section.id, "description", e.target.value)
                                                                            }
                                                                        />
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <Label>Contact Info Card Title</Label>
                                                                        <Input
                                                                            value={section.content.contact_info_title || ""}
                                                                            onChange={(e) =>
                                                                                updateSectionContent(section.id, "contact_info_title", e.target.value)
                                                                            }
                                                                            placeholder="Contact Information"
                                                                        />
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <Label>Contact Form Title</Label>
                                                                        <Input
                                                                            value={section.content.contact_form_title || ""}
                                                                            onChange={(e) =>
                                                                                updateSectionContent(section.id, "contact_form_title", e.target.value)
                                                                            }
                                                                            placeholder="Send us a Message"
                                                                        />
                                                                    </div>
                                                                    <div className="space-y-1 md:col-span-2">
                                                                        <Label>Form Button Label</Label>
                                                                        <Input
                                                                            value={section.content.contact_form_button_label || ""}
                                                                            onChange={(e) =>
                                                                                updateSectionContent(
                                                                                    section.id,
                                                                                    "contact_form_button_label",
                                                                                    e.target.value
                                                                                )
                                                                            }
                                                                            placeholder="Send Message"
                                                                        />
                                                                    </div>
                                                                    <div className="space-y-1 md:col-span-2">
                                                                        <Label>Address Lines (one per line)</Label>
                                                                        <Textarea
                                                                            rows={4}
                                                                            value={getContactLines(section, "contact_address_lines").join("\n")}
                                                                            onChange={(e) =>
                                                                                setContactLines(
                                                                                    section.id,
                                                                                    "contact_address_lines",
                                                                                    e.target.value
                                                                                        .split("\n")
                                                                                        .map((item) => item.trim())
                                                                                        .filter(Boolean)
                                                                                )
                                                                            }
                                                                        />
                                                                    </div>
                                                                    <div className="space-y-1 md:col-span-2">
                                                                        <Label>Phone Lines (one per line)</Label>
                                                                        <Textarea
                                                                            rows={4}
                                                                            value={getContactLines(section, "contact_phone_lines").join("\n")}
                                                                            onChange={(e) =>
                                                                                setContactLines(
                                                                                    section.id,
                                                                                    "contact_phone_lines",
                                                                                    e.target.value
                                                                                        .split("\n")
                                                                                        .map((item) => item.trim())
                                                                                        .filter(Boolean)
                                                                                )
                                                                            }
                                                                        />
                                                                    </div>
                                                                    <div className="space-y-1 md:col-span-2">
                                                                        <Label>Email Lines (one per line)</Label>
                                                                        <Textarea
                                                                            rows={4}
                                                                            value={getContactLines(section, "contact_email_lines").join("\n")}
                                                                            onChange={(e) =>
                                                                                setContactLines(
                                                                                    section.id,
                                                                                    "contact_email_lines",
                                                                                    e.target.value
                                                                                        .split("\n")
                                                                                        .map((item) => item.trim())
                                                                                        .filter(Boolean)
                                                                                )
                                                                            }
                                                                        />
                                                                    </div>
                                                                    <div className="space-y-1 md:col-span-2">
                                                                        <Label>Office Hours (one per line)</Label>
                                                                        <Textarea
                                                                            rows={4}
                                                                            value={getContactLines(section, "contact_hours_lines").join("\n")}
                                                                            onChange={(e) =>
                                                                                setContactLines(
                                                                                    section.id,
                                                                                    "contact_hours_lines",
                                                                                    e.target.value
                                                                                        .split("\n")
                                                                                        .map((item) => item.trim())
                                                                                        .filter(Boolean)
                                                                                )
                                                                            }
                                                                        />
                                                                    </div>
                                                                </>
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
                                                            void uploadMedia(file, uploadDisplayName);
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
                                    <div className="mb-4 rounded-lg border border-slate-200 bg-gradient-to-r from-slate-50 via-emerald-50 to-sky-50 p-4">
                                        {usesStrictPublishChecklist ? (
                                            <>
                                                <div className="mb-2 flex items-center justify-between gap-2">
                                                    <p className="text-sm font-semibold text-slate-900">Publish Readiness</p>
                                                    <Badge variant={canPublishSite ? "default" : "outline"} className={canPublishSite ? "bg-emerald-600" : ""}>
                                                        {completedPublishChecklistItems}/{totalPublishChecklistItems} complete
                                                    </Badge>
                                                </div>
                                                <Progress value={publishProgressPercent} className="h-2.5" />
                                                <p className="mt-2 text-xs text-slate-600">
                                                    {canPublishSite
                                                        ? "Everything is customized. You can publish when ready."
                                                        : `${publishProgressPercent}% complete. Finish all sections and global settings to unlock publishing.`}
                                                </p>
                                                {globalSettingsQualification.missingLabels.length > 0 ? (
                                                    <p className="mt-2 text-xs text-amber-700">
                                                        Global settings missing: {globalSettingsQualification.missingLabels.join(", ")}.
                                                    </p>
                                                ) : null}
                                                {sectionsNeedingCustomization.length > 0 ? (
                                                    <div className="mt-2 flex flex-wrap gap-2">
                                                        {sectionsNeedingCustomization.map((section) => (
                                                            <Button
                                                                key={section.id}
                                                                type="button"
                                                                size="sm"
                                                                variant="outline"
                                                                className="h-7 border-amber-300 text-amber-700"
                                                                onClick={() => setActiveEditorTab(`section-${section.id}`)}
                                                            >
                                                                Edit {section.section_label || section.section_key}
                                                            </Button>
                                                        ))}
                                                    </div>
                                                ) : null}
                                            </>
                                        ) : (
                                            <>
                                                <div className="mb-2 flex items-center justify-between gap-2">
                                                    <p className="text-sm font-semibold text-slate-900">Independent Publish Mode</p>
                                                    <Badge className="bg-sky-600">Hall Of Fame</Badge>
                                                </div>
                                                <p className="text-xs text-slate-600">
                                                    This page can publish independently from homepage readiness. Save your sections, then publish when ready.
                                                </p>
                                            </>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3">
                                        <Button
                                            variant="outline"
                                            onClick={() => setPage((prev) => (prev ? { ...prev, status: "draft" } : prev))}
                                        >
                                            Save as Draft
                                        </Button>
                                        <Button
                                            onClick={handleMarkPublished}
                                            className="bg-emerald-600 hover:bg-emerald-700"
                                            disabled={usesStrictPublishChecklist && !canPublishSite}
                                        >
                                            <Globe className="mr-2 h-4 w-4" />
                                            Mark as Published
                                        </Button>
                                        <span className="text-sm text-slate-500">
                                            {usesStrictPublishChecklist
                                                ? "Click Save Changes after selecting status. Publishing unlocks only at 100% readiness."
                                                : `Click Save Changes after selecting status to publish ${activePageLabel} independently.`}
                                        </span>
                                    </div>
                                </div>

                                <Separator />
                                <p className="text-xs text-slate-500">
                                    Sections scaffolded from your intended layout: {pageTemplates.map((s) => s.key).join(", ")}.
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
                                                key={`${selectedPageSlug}-${activeSection?.section_key || "page"}-${previewNonce}`}
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

                        {hasUnsavedChanges ? (
                            <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-full border border-amber-300 bg-amber-50 px-4 py-2 shadow-lg">
                                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
                                <p className="text-sm font-medium text-amber-900">Unsaved changes</p>
                                <Button size="sm" onClick={saveAll} disabled={saving || loading}>
                                    {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                                    Save now
                                </Button>
                            </div>
                        ) : null}
                    </>
                )}
            </div>
        </DashboardLayout>
    );
}
