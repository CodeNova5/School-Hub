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
  | "contact";

export interface WebsiteSectionContent {
  heading?: string;
  subheading?: string;
  description?: string;
  image_url?: string;
  button_label?: string;
  button_link?: string;
  items?: string[];
}

export interface WebsiteSectionTemplate {
  key: WebsiteSectionKey;
  label: string;
  order: number;
  visible: boolean;
  content: WebsiteSectionContent;
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
      items: ["Science", "Arts", "Commerce", "Technology"],
    },
  },
  {
    key: "facilities",
    label: "Facilities",
    order: 4,
    visible: true,
    content: {
      heading: "Facilities",
      items: ["Library", "Laboratories", "ICT Center", "Sports Complex"],
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
    },
  },
  {
    key: "testimonials",
    label: "Testimonials",
    order: 7,
    visible: true,
    content: {
      heading: "What Families Say",
      description: "Trusted by parents and loved by students.",
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
    },
  },
  {
    key: "admissions",
    label: "Admissions",
    order: 9,
    visible: true,
    content: {
      heading: "Admissions",
      description: "Join our school community today.",
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
    },
  },
];
