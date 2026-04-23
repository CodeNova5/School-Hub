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
          title: "Science Stream",
          description: "Physics, Chemistry, Biology, and Mathematics with strong lab-based learning.",
          icon: "🔬",
        },
        {
          title: "Arts Stream",
          description: "History, Literature, Geography, and Social Sciences with deep analysis.",
          icon: "📖",
        },
        {
          title: "Commerce Stream",
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
    },
  },
];
