export type WebsiteSectionKey =
  | "home"
  | "about"
  | "programs"
  | "facilities"
  | "faculty"
  | "news"
  | "testimonials"
  | "gallery"
  | "admissions"
  | "contact"
  | "achievements_hero"
  | "achievements_timeline"
  | "hall_of_fame"
  | "achievements_awards"
  | "achievements_cta"
  | "academics_hero"
  | "academics_class_levels"
  | "academics_curriculum"
  | "academics_gallery";

export type WebsitePageSlug = "home" | "hall-of-fame" | "academics";

export interface WebsiteProgramItem {
  title: string;
  description: string;
  icon?: string;
  image_url?: string;
}

export interface WebsiteFacilityItem {
  title: string;
  description: string;
  icon?: string;
  image_url?: string;
}

export interface WebsiteSectionContent {
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
  program_items?: WebsiteProgramItem[];
  facility_items?: WebsiteFacilityItem[];
  faculty_items?: {
    title: string;
    position?: string;
    description: string;
    image_url?: string;
  }[];
  news_items?: {
    title: string;
    description: string;
  }[];
  testimonial_items?: {
    text: string;
    author: string;
    role?: string;
  }[];
  gallery_items?: {
    image_url: string;
    caption?: string;
  }[];
  class_level_items?: {
    title: string;
    description: string;
    grade_range?: string;
    icon?: string;
    image_url?: string;
  }[];
  curriculum_items?: {
    subject: string;
    description: string;
    grade_levels?: string;
    skills?: string[];
    image_url?: string;
    icon?: string;
  }[];
  academics_cards?: {
    image_url: string;
    sample_subjects: string[];
  }[];
}

export interface WebsiteSectionTemplate {
  key: WebsiteSectionKey;
  label: string;
  order: number;
  visible: boolean;
  content: WebsiteSectionContent;
}

export interface WebsiteSiteSettingsDefaults {
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

export const WEBSITE_DEFAULT_SITE_SETTINGS: WebsiteSiteSettingsDefaults = {
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

export interface WebsiteGlobalSettingsQualification {
  ready: boolean;
  missingLabels: string[];
}

export interface WebsiteColorThemePreset {
  id: string;
  name: string;
  primary: string;
  secondary: string;
}

export const WEBSITE_COLOR_THEME_PRESETS: WebsiteColorThemePreset[] = [
  { id: "classic-navy-emerald", name: "Classic Navy + Emerald", primary: "#1e3a8a", secondary: "#059669" },
  { id: "royal-blue-gold", name: "Royal Blue + Gold", primary: "#1d4ed8", secondary: "#ca8a04" },
  { id: "teal-coral", name: "Teal + Coral", primary: "#0f766e", secondary: "#f97316" },
  { id: "plum-rose", name: "Plum + Rose", primary: "#7e22ce", secondary: "#e11d48" },
  { id: "forest-lime", name: "Forest + Lime", primary: "#166534", secondary: "#65a30d" },
  { id: "slate-cyan", name: "Slate + Cyan", primary: "#334155", secondary: "#0891b2" },
  { id: "charcoal-amber", name: "Charcoal + Amber", primary: "#1f2937", secondary: "#d97706" },
  { id: "indigo-sky", name: "Indigo + Sky", primary: "#4338ca", secondary: "#0284c7" },
];

function normalizeForComparison(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeForComparison(item));
  }

  if (value && typeof value === "object") {
    const normalized: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const child = normalizeForComparison((value as Record<string, unknown>)[key]);
      if (child === undefined) continue;
      normalized[key] = child;
    }
    return normalized;
  }

  if (typeof value === "string") {
    return value.trim();
  }

  return value;
}

export function isWebsiteSectionCustomized(sectionKey: string, content: unknown, pageSlug: WebsitePageSlug = "home"): boolean {
  const template = getWebsiteSectionTemplatesForPage(pageSlug).find((item) => item.key === sectionKey);
  if (!template) return true;

  const current = JSON.stringify(normalizeForComparison(content || {}));
  const templateContent = JSON.stringify(normalizeForComparison(template.content || {}));
  return current !== templateContent;
}

export function getWebsiteGlobalSettingsQualification(settings: Partial<WebsiteSiteSettingsDefaults>): WebsiteGlobalSettingsQualification {
  const merged: WebsiteSiteSettingsDefaults = {
    ...WEBSITE_DEFAULT_SITE_SETTINGS,
    ...settings,
  };

  const missingLabels: string[] = [];

  if (!merged.logo_url.trim()) {
    missingLabels.push("Logo URL");
  }
  if (!merged.primary_color.trim()) {
    missingLabels.push("Primary color");
  }
  if (!merged.secondary_color.trim()) {
    missingLabels.push("Secondary color");
  }

  return {
    ready: missingLabels.length === 0,
    missingLabels,
  };
}

export const WEBSITE_SECTION_TEMPLATES: WebsiteSectionTemplate[] = [
  {
    key: "home",
    label: "Hero",
    order: 1,
    visible: true,
    content: {
      heading: "Welcome to Our School",
      subheading: "Excellence in education and character",
      button_label: "Apply Now",
      button_link: "#admissions",
      hero_card_badge: "Student Focus",
      hero_card_title: "Modern learning. Strong values. Real outcomes.",
      hero_card_description: "A school website built to communicate trust, clarity, and excellence from the first glance.",
      hero_stats: ["850+|Students", "95%|Pass Rate", "25+|Years", "50+|Faculty"],
    },
  },
  {
    key: "about",
    label: "About",
    order: 2,
    visible: true,
    content: {
      heading: "About Our School",
      description: "We are committed to academic excellence and holistic student development.",
      mission: "Our Mission\n\nTo provide quality education that develops critical thinking, creativity, and character while empowering students to become responsible global citizens.",
      vision: "Our Vision\n\nA learning community where every student achieves excellence, discovers their potential, and contributes meaningfully to society.",
    },
  },
  {
    key: "programs",
    label: "Programs",
    order: 3,
    visible: true,
    content: {
      heading: "Academic Programs",
      subheading: "Well-rounded and future-ready learning paths",
      program_items: [
        {
          title: "Science Department",
          description: "Physics, Chemistry, Biology, and Mathematics with strong lab-based learning.",
          icon: "🔬",
        },
        {
          title: "Arts Department",
          description: "History, Literature, Geography, and Social Sciences with deep analysis.",
          icon: "📖",
        },
        {
          title: "Commerce Department",
          description: "Accounting, Economics, and Business Studies for professional readiness.",
          icon: "💼",
        },
        {
          title: "Computer Science",
          description: "Coding, algorithms, web development, and modern digital skills.",
          icon: "🖥️",
        },
        {
          title: "Co-Curricular",
          description: "Sports, arts, music, and leadership programs for holistic growth.",
          icon: "🎨",
        },
        {
          title: "Skill Development",
          description: "Career guidance, communication, and life skills for future success.",
          icon: "🌍",
        },
      ],
    },
  },
  {
    key: "facilities",
    label: "Facilities",
    order: 4,
    visible: true,
    content: {
      heading: "Facilities",
      subheading: "State-of-the-art infrastructure for holistic development",
      facility_items: [
        {
          title: "Modern Laboratories",
          description: "Well-equipped science and computer labs with the latest technology.",
          icon: "🔬",
        },
        {
          title: "Central Library",
          description: "Extensive books, digital resources, and reading areas.",
          icon: "📚",
        },
        {
          title: "Sports Complex",
          description: "Indoor and outdoor sports facilities for active development.",
          icon: "🏃",
        },
        {
          title: "Auditorium",
          description: "A professional event space for presentations and performances.",
          icon: "🎭",
        },
        {
          title: "Cafeteria",
          description: "Hygienic, spacious, and nutritious meal service.",
          icon: "🍽️",
        },
        {
          title: "Smart Classrooms",
          description: "Interactive learning spaces with digital teaching tools.",
          icon: "🏫",
        },
      ],
    },
  },
  {
    key: "faculty",
    label: "Faculty",
    order: 5,
    visible: true,
    content: {
      heading: "Our Faculty",
      description: "Experienced educators shaping future leaders.",
      faculty_items: [
        {
          title: "Dr. Rajesh Kumar",
          position: "Principal",
          description: "Experienced academic leader focused on institutional excellence.",
        },
        {
          title: "Ms. Priya Sharma",
          position: "Head of Science Department",
          description: "Curriculum development and student mentorship specialist.",
        },
        {
          title: "Mr. Arun Verma",
          position: "Head of Humanities",
          description: "Innovative teaching methodologies and cultural education.",
        },
        {
          title: "Dr. Anjali Patel",
          position: "Counselor & Psychologist",
          description: "Student welfare, career guidance, and holistic development.",
        },
      ],
    },
  },
  {
    key: "news",
    label: "News",
    order: 6,
    visible: true,
    content: {
      heading: "News and Updates",
      subheading: "Latest announcements and school events",
      news_items: [
        {
          title: "Annual Sports Day Announced",
          description: "Students, parents, and staff are invited to celebrate this year’s athletics and team events.",
        },
        {
          title: "New Science Lab Opening",
          description: "A modern lab space will support hands-on learning in physics, chemistry, and biology.",
        },
        {
          title: "Parent-Teacher Conference Week",
          description: "Book your slot to discuss progress, goals, and support plans with teachers.",
        },
      ],
    },
  },
  {
    key: "testimonials",
    label: "Testimonials",
    order: 7,
    visible: true,
    content: {
      heading: "What Families Say",
      subheading: "Hear from our students and parents about their experience at our school",
      description: "Trusted by parents and loved by students.",
      testimonial_items: [
        {
          text: "The school has created a caring environment where our child feels supported and challenged every day.",
          author: "Mrs. Amina Bello",
          role: "Parent",
        },
        {
          text: "The teachers are attentive, approachable, and genuinely invested in student success.",
          author: "Daniel K.",
          role: "Grade 10 Student",
        },
        {
          text: "We’ve seen amazing growth in confidence, communication, and academic performance.",
          author: "Mr. Chinedu Okafor",
          role: "Parent",
        },
      ],
    },
  },
  {
    key: "gallery",
    label: "Gallery",
    order: 8,
    visible: true,
    content: {
      heading: "Gallery",
      subheading: "Moments from our campus life",
      gallery_items: [
        {
          image_url: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1200&q=80",
          caption: "Students collaborating in class",
        },
        {
          image_url: "https://images.unsplash.com/photo-1523580846011-d3a5bc25702b?auto=format&fit=crop&w=1200&q=80",
          caption: "Campus events and celebrations",
        },
        {
          image_url: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1200&q=80",
          caption: "Teachers guiding learners",
        },
      ],
    },
  },
  {
    key: "admissions",
    label: "Admissions",
    order: 9,
    visible: true,
    content: {
      heading: "Admissions",
      subheading: "Join our community of learners and leaders",
      description: "We welcome students who demonstrate academic potential, leadership qualities, and a commitment to excellence.",
      admissions_requirements: [
        "Age-appropriate for the applying class",
        "Previous academic records",
        "Entrance examination (if applicable)",
        "Personal interview and aptitude assessment",
        "Transfer certificate from previous institution",
        "Character certificate and health records",
      ],
      admissions_steps: [
        "Application Form — Submit complete application with required documents",
        "Entrance Test — Evaluate academic aptitude and learning capability",
        "Personal Interview — Meet admission counselors to assess fit",
        "Merit List — Selection based on comprehensive evaluation",
        "Admission Confirmation — Fee deposit and official enrollment",
      ],
      button_label: "Start Application",
      button_link: "#contact",
    },
  },
  {
    key: "contact",
    label: "Contact",
    order: 10,
    visible: true,
    content: {
      heading: "Contact Us",
      subheading: "We would love to hear from you",
      description: "We'd love to hear from you. Contact us for admissions, inquiries, or feedback.",
      contact_info_title: "Contact Information",
      contact_form_title: "Send us a Message",
      contact_form_button_label: "Send Message",
      contact_address_lines: ["School Name, Education Avenue", "City Center, State 123456", "India"],
      contact_phone_lines: ["Main Office: +91 (123) 456-7890", "Admissions: +91 (123) 456-7891", "Support: +91 (123) 456-7892"],
      contact_email_lines: ["info@school.edu", "admissions@school.edu", "support@school.edu"],
      contact_hours_lines: ["Monday - Friday: 8:00 AM - 4:00 PM", "Saturday: 9:00 AM - 1:00 PM", "Sunday: Closed"],
    },
  },
];

export const WEBSITE_HALL_OF_FAME_SECTION_TEMPLATES: WebsiteSectionTemplate[] = [
  {
    key: "achievements_hero",
    label: "Hall of Fame Hero",
    order: 1,
    visible: true,
    content: {
      heading: "Hall of Fame & Achievements",
      subheading: "Celebrating excellence, impact, and remarkable milestones",
      description: "Explore standout achievements from our students, alumni, teams, and staff.",
      image_url: "https://tsdsi.in/wp-content/uploads/2024/12/Hall-of-Fame-Awards-Ceremony-Web-Banner2025_v2-1.jpg",
      button_label: "Nominate an Achiever",
      button_link: "#achievements-cta",
    },
  },
  {
    key: "achievements_timeline",
    label: "Achievements Timeline",
    order: 2,
    visible: true,
    content: {
      heading: "Milestone Timeline",
      subheading: "A quick look at our most memorable wins",
      items: [
        "2026 | National STEM Challenge Champions",
        "2025 | Regional Debate League Gold Medal",
        "2024 | Excellence in Community Impact Award",
      ],
    },
  },
  {
    key: "hall_of_fame",
    label: "Hall of Fame",
    order: 3,
    visible: true,
    content: {
      heading: "Hall of Fame",
      subheading: "Students and staff who raised the bar",
      faculty_items: [
        {
          title: "Ada Chukwu",
          position: "Best Graduating Student 2025",
          description: "Graduated with distinction and represented the school nationally in mathematics.",
        },
        {
          title: "Coach Ibrahim Bello",
          position: "Sports Excellence Mentor",
          description: "Led the school athletics team to three consecutive state championships.",
        },
        {
          title: "Debate Team",
          position: "National Finalists",
          description: "Reached national finals with outstanding public speaking and policy analysis.",
        },
      ],
    },
  },
  {
    key: "achievements_awards",
    label: "Awards & Recognition",
    order: 4,
    visible: true,
    content: {
      heading: "Awards & Recognitions",
      subheading: "Notable honors earned by our school community",
      news_items: [
        {
          title: "Academic Excellence Award",
          description: "Recognized for exceptional performance in external examinations.",
        },
        {
          title: "Innovation in Education",
          description: "Awarded for introducing student-led project-based learning initiatives.",
        },
        {
          title: "Community Service Recognition",
          description: "Honored for sustained impact through local outreach and volunteering.",
        },
      ],
    },
  },
  {
    key: "achievements_cta",
    label: "Call To Action",
    order: 5,
    visible: true,
    content: {
      heading: "Share the Next Great Story",
      description: "Know someone who deserves to be celebrated? Send us their story and achievement.",
      button_label: "Submit Achievement",
      button_link: "#contact",
    },
  },
];

export const WEBSITE_ACADEMICS_SECTION_TEMPLATES: WebsiteSectionTemplate[] = [
  {
    key: "academics_hero",
    label: "Academics Hero",
    order: 1,
    visible: true,
    content: {
      heading: "Our Academic Excellence",
      subheading: "Rigorous learning, clear pathways, and subject combinations shaped by each level.",
      description: "The live academics page pulls structure from the school database. Edit only the showcase card imagery and sample subjects here.",
      image_url: "",
      button_label: "Explore Programs",
      button_link: "#academics_overview",
      academics_cards: [
        {
          image_url: "",
          sample_subjects: ["Mathematics", "English", "Science"],
        },
        {
          image_url: "",
          sample_subjects: ["Physics", "Chemistry", "Biology"],
        },
        {
          image_url: "",
          sample_subjects: ["Economics", "Computer Science", "Business Studies"],
        },
      ],
    },
  },
];

export const WEBSITE_PAGE_SECTION_TEMPLATES: Record<WebsitePageSlug, WebsiteSectionTemplate[]> = {
  home: WEBSITE_SECTION_TEMPLATES,
  "hall-of-fame": WEBSITE_HALL_OF_FAME_SECTION_TEMPLATES,
  academics: WEBSITE_ACADEMICS_SECTION_TEMPLATES,
};

export function getWebsiteSectionTemplatesForPage(pageSlug: string | undefined): WebsiteSectionTemplate[] {
  if (pageSlug === "hall-of-fame") {
    return WEBSITE_PAGE_SECTION_TEMPLATES["hall-of-fame"];
  }
  if (pageSlug === "academics") {
    return WEBSITE_PAGE_SECTION_TEMPLATES.academics;
  }
  return WEBSITE_PAGE_SECTION_TEMPLATES.home;
}
