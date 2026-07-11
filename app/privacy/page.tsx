import Link from "next/link";
import {
  GraduationCap,
  Shield,
  Mail,
  Phone,
  MapPin,
  ChevronRight,
  FileText,
  Clock,
  Database,
  Eye,
  Lock,
  Cookie,
  Users,
  Globe,
  AlertTriangle,
  HeartHandshake,
  RefreshCw,
  BarChart3,
} from "lucide-react";

const sections = [
  {
    id: "introduction",
    icon: Shield,
    title: "Introduction",
    content: (
      <>
        <p className="mb-4">
          School Hub (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) is committed to protecting
          the privacy and security of your personal data. This Privacy Policy explains how we
          collect, use, disclose, and safeguard your information when you use our multi-tenant
          school management platform, including our website, mobile applications, and related
          services (collectively, the &ldquo;Platform&rdquo;).
        </p>
        <p className="mb-4">
          We operate as a data processor on behalf of the schools that use our Platform
          (&ldquo;Schools&rdquo;), and as a data controller for the information we collect directly
          from visitors to our website and platform administrators. This policy covers our
          practices in both capacities.
        </p>
        <p>
          By accessing or using the Platform, you acknowledge that you have read and understood
          this Privacy Policy. If you do not agree with our policies and practices, please do not
          use the Platform.
        </p>
      </>
    ),
  },
  {
    id: "information-we-collect",
    icon: Database,
    title: "Information We Collect",
    content: (
      <>
        <p className="mb-4">
          We collect several types of information from and about users of our Platform, including:
        </p>

        <h4 className="text-sm font-bold text-gray-800 mb-2 mt-6">1. Information You Provide to Us</h4>
        <ul className="space-y-2 mb-4 ml-4">
          {[
            "School information: name, address, email, phone number, logo, motto, and other institutional details",
            "Account credentials: name, email address, password, and role (admin, teacher, student, parent)",
            "Student records: name, date of birth, gender, contact information, class assignments, academic results, attendance records, disciplinary records, and other education-related data",
            "Teacher records: name, contact information, qualifications, employment history, payroll details, and performance data",
            "Parent/guardian information: name, contact details, relationship to student, and communication preferences",
            "Payment information: when processing payments through our Platform, payment data is handled directly by our payment processor (Paystack) and is not stored by us",
            "Communication data: messages sent through the Platform, support inquiries, and feedback",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-gray-600">
              <ChevronRight className="h-3.5 w-3.5 text-blue-500 mt-1 flex-shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <h4 className="text-sm font-bold text-gray-800 mb-2 mt-6">2. Information We Collect Automatically</h4>
        <ul className="space-y-2 mb-4 ml-4">
          {[
            "Usage data: pages visited, features used, time spent on the Platform, and navigation patterns",
            "Device information: IP address, browser type, operating system, device type, and unique device identifiers",
            "Log data: access times, referring URLs, and error logs",
            "Cookies and similar tracking technologies (see our Cookie Policy below)",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-gray-600">
              <ChevronRight className="h-3.5 w-3.5 text-blue-500 mt-1 flex-shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <h4 className="text-sm font-bold text-gray-800 mb-2 mt-6">3. Information from Third Parties</h4>
        <ul className="space-y-2 ml-4">
          {[
            "Payment processors: Paystack provides us with transaction confirmations and payment status (we never store full payment card details)",
            "Authentication services: if you use single sign-on or other authentication methods",
            "School systems: when Schools import data from other management systems or spreadsheets",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-gray-600">
              <ChevronRight className="h-3.5 w-3.5 text-blue-500 mt-1 flex-shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </>
    ),
  },
  {
    id: "how-we-use",
    icon: Eye,
    title: "How We Use Your Information",
    content: (
      <>
        <p className="mb-4">
          We use the information we collect for the following purposes:
        </p>

        <div className="space-y-3">
          {[
            {
              icon: GraduationCap,
              title: "Providing and Improving the Platform",
              desc: "To operate, maintain, and enhance the Platform, including processing academic records, generating reports, managing timetables, facilitating communication, and delivering all features described in our service offering.",
            },
            {
              icon: Lock,
              title: "Security and Fraud Prevention",
              desc: "To protect the security and integrity of the Platform, detect and prevent unauthorized access, fraud, and abuse, and enforce our Terms of Service.",
            },
            {
              icon: Mail,
              title: "Communication",
              desc: "To send administrative information, service updates, security alerts, and support messages. We may also send marketing communications with your consent, which you can opt out of at any time.",
            },
            {
              icon: Users,
              title: "Personalization",
              desc: "To tailor the user experience based on roles and preferences, including role-specific dashboards, notifications, and feature access.",
            },
            {                icon: BarChart3,
              title: "Analytics and Improvement",
              desc: "To analyze usage patterns, diagnose technical issues, and make data-driven improvements to the Platform.",
            },
            {
              icon: Shield,
              title: "Compliance and Legal Obligations",
              desc: "To comply with applicable laws, regulations, and legal processes, including the Nigeria Data Protection Regulation (NDPR), GDPR (where applicable), and other relevant data protection frameworks.",
            },
          ].map((item) => (
            <div key={item.title} className="flex items-start gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
              <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
                <item.icon className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-gray-800">{item.title}</h4>
                <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </>
    ),
  },
  {
    id: "legal-basis",
    icon: FileText,
    title: "Legal Basis for Processing (GDPR/NDPR)",
    content: (
      <>
        <p className="mb-4">
          Where required by applicable data protection laws (including the GDPR and Nigeria Data
          Protection Regulation), we rely on the following legal bases for processing your personal
          data:
        </p>
        <div className="space-y-3">
          {[
            {
              title: "Contractual Necessity",
              desc: "Processing is necessary to perform our contract with Schools and to provide the Platform services they have subscribed to.",
            },
            {
              title: "Legitimate Interests",
              desc: "We process data for our legitimate interests in operating, securing, and improving the Platform, provided these interests do not override your fundamental rights.",
            },
            {
              title: "Consent",
              desc: "Where we rely on consent, you have the right to withdraw your consent at any time without affecting the lawfulness of processing based on consent before its withdrawal.",
            },
            {
              title: "Legal Compliance",
              desc: "Processing is necessary to comply with legal obligations, such as retaining records for tax or regulatory purposes.",
            },
          ].map((item) => (
            <div key={item.title} className="flex items-start gap-3 p-3 rounded-lg bg-white border border-gray-100 shadow-sm">
              <div className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-500 mt-2" />
              <div>
                <h4 className="text-sm font-bold text-gray-800">{item.title}</h4>
                <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </>
    ),
  },
  {
    id: "data-sharing",
    icon: Globe,
    title: "Data Sharing and Disclosure",
    content: (
      <>
        <p className="mb-4">
          We do not sell your personal data. We may share your information only in the following
          circumstances:
        </p>

        <h4 className="text-sm font-bold text-gray-800 mb-2 mt-6">With Schools (as Data Controllers)</h4>
        <p className="text-sm text-gray-600 mb-4">
          When a School uses our Platform, we process student, parent, and teacher data on their
          behalf. The School is the data controller for this information, and their own privacy
          policies may also apply. We share relevant data with the School as necessary to provide
          our services.
        </p>

        <h4 className="text-sm font-bold text-gray-800 mb-2 mt-6">With Service Providers</h4>
        <p className="text-sm text-gray-600 mb-4">
          We engage trusted third-party service providers to help us deliver the Platform,
          including:
        </p>
        <ul className="space-y-2 mb-4 ml-4">
          {[
            "Cloud hosting: Supabase (PostgreSQL database) and Vercel (application hosting)",
            "Payment processing: Paystack for secure payment handling",
            "Email delivery: Resend for transactional email communications",
            "Notifications: Firebase Cloud Messaging for push notifications",
            "AI services: For AI-powered features like lesson note generation and question bank creation. These services process data only as instructed and do not use it to train their models.",
            "Analytics: To help us understand Platform usage and improve our services",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-gray-600">
              <ChevronRight className="h-3.5 w-3.5 text-blue-500 mt-1 flex-shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <h4 className="text-sm font-bold text-gray-800 mb-2 mt-6">For Legal Reasons</h4>
        <p className="text-sm text-gray-600 mb-4">
          We may disclose information if required to do so by law or in response to valid legal
          requests by public authorities (e.g., court orders, law enforcement requests).
        </p>

        <h4 className="text-sm font-bold text-gray-800 mb-2 mt-6">Business Transfers</h4>
        <p className="text-sm text-gray-600">
          In the event of a merger, acquisition, or sale of all or a portion of our assets, your
          information may be transferred as part of that transaction. We will notify you of any
          such change in ownership or control.
        </p>
      </>
    ),
  },
  {
    id: "data-retention",
    icon: Clock,
    title: "Data Retention",
    content: (
      <>
        <p className="mb-4">
          We retain your personal data only for as long as is necessary to fulfill the purposes
          described in this Privacy Policy, or as required by applicable law.
        </p>
        <ul className="space-y-3">
          {[
            "Account data: Retained for the duration of your account plus a reasonable period thereafter to allow for account reactivation or data export.",
            "Student academic records: Retained in accordance with School policies and applicable educational record retention laws. Schools can export and delete this data at any time.",
            "Transaction records: Retained for 7 years (or as required by tax/regulatory obligations).",
            "Usage analytics: Aggregated and anonymized data may be retained indefinitely for analytical purposes.",
            "Upon termination of a School&apos;s subscription, we provide a reasonable window for data export before secure deletion, unless the School requests earlier deletion.",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-gray-600">
              <ChevronRight className="h-3.5 w-3.5 text-blue-500 mt-1 flex-shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </>
    ),
  },
  {
    id: "data-security",
    icon: Lock,
    title: "Data Security",
    content: (
      <>
        <p className="mb-4">
          We implement appropriate technical and organizational measures to protect your personal
          data against unauthorized access, alteration, disclosure, or destruction. These include:
        </p>
        <div className="grid sm:grid-cols-2 gap-3 mb-4">
          {[
            { icon: Lock, label: "Encryption at rest and in transit using industry-standard protocols (TLS 1.3)" },
            { icon: Shield, label: "Row-Level Security (RLS) in our database to ensure multi-tenant data isolation" },
            { icon: Users, label: "Role-based access controls (RBAC) limiting data access by user role" },
            { icon: Clock, label: "Regular security audits and vulnerability assessments" },
            { icon: Database, label: "Automated encrypted backups with tested restoration procedures" },
            { icon: Eye, label: "Comprehensive audit logging of all data access and modifications" },
          ].map((item) => (
            <div key={item.label} className="flex items-start gap-2.5 p-3 rounded-lg bg-gray-50 border border-gray-100">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                <item.icon className="h-4 w-4 text-emerald-600" />
              </div>
              <span className="text-xs text-gray-700 font-medium leading-relaxed">{item.label}</span>
            </div>
          ))}
        </div>
        <p className="text-sm text-gray-600">
          Despite our best efforts, no method of transmission over the Internet or electronic
          storage is 100% secure. We cannot guarantee absolute security, but we are committed to
          promptly notifying affected users in the event of a data breach as required by applicable
          law.
        </p>
      </>
    ),
  },
  {
    id: "your-rights",
    icon: Users,
    title: "Your Data Protection Rights",
    content: (
      <>
        <p className="mb-4">
          Depending on your jurisdiction, you may have the following rights regarding your personal
          data:
        </p>
        <div className="space-y-2 mb-6">
          {[
            { right: "Right of Access", desc: "Request a copy of the personal data we hold about you." },
            { right: "Right to Rectification", desc: "Request correction of inaccurate or incomplete data." },
            { right: "Right to Erasure", desc: "Request deletion of your personal data, subject to certain exceptions." },
            { right: "Right to Restriction", desc: "Request restriction of processing of your personal data." },
            { right: "Right to Data Portability", desc: "Request transfer of your data to another service provider in a structured, commonly used format." },
            { right: "Right to Object", desc: "Object to processing of your personal data for certain purposes, including direct marketing." },
            { right: "Right to Withdraw Consent", desc: "Withdraw consent at any time where we rely on consent as the legal basis." },
            { right: "Right to Lodge a Complaint", desc: "File a complaint with the relevant data protection authority in your jurisdiction." },
          ].map((item) => (
            <div key={item.right} className="flex items-start gap-3 p-3 rounded-lg bg-white border border-gray-100 shadow-sm">
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center mt-0.5">
                <ChevronRight className="h-3 w-3 text-blue-600" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-gray-800">{item.right}</h4>
                <p className="text-xs text-gray-600 mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-sm text-gray-600">
          To exercise any of these rights, please contact us at the email address below. We will
          respond to your request within 30 days, or as otherwise required by applicable law.
          Please note that if your data is processed on behalf of a School, we may need to involve
          the School in responding to your request.
        </p>
      </>
    ),
  },
  {
    id: "children-privacy",
    icon: HeartHandshake,
    title: "Children&apos;s Privacy",
    content: (
      <>
        <p className="mb-4">
          Our Platform is used by Schools to manage educational data, which may include information
          about children under the age of 13 (or the equivalent minimum age in the relevant
          jurisdiction). We recognize the special need to protect children&apos;s privacy.
        </p>
        <ul className="space-y-3">
          {[
            "We process children&apos;s data only on behalf of and under the instruction of the School, which is responsible for obtaining any necessary parental consent.",
            "We do not use children&apos;s data for behavioral advertising or any purpose other than providing the educational services requested by the School.",
            "Children&apos;s data is never sold or shared for unrelated third-party purposes.",
            "Parents or legal guardians may request access to, or deletion of, their child&apos;s data by contacting the School directly or by contacting us at the email below.",
            "If we become aware that we have collected personal data from a child without appropriate consent, we will take steps to delete that information promptly.",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-gray-600">
              <ChevronRight className="h-3.5 w-3.5 text-blue-500 mt-1 flex-shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </>
    ),
  },
  {
    id: "cookies",
    icon: Cookie,
    title: "Cookie Policy",
    content: (
      <>
        <p className="mb-4">
          We use cookies and similar tracking technologies to enhance your experience on our
          Platform. Cookies are small text files stored on your device that help us remember your
          preferences and understand how you use the Platform.
        </p>

        <h4 className="text-sm font-bold text-gray-800 mb-2 mt-6">Types of Cookies We Use</h4>
        <div className="space-y-3 mb-4">
          {[
            {
              title: "Essential Cookies",
              desc: "Required for the Platform to function properly. These include session cookies for authentication, security cookies, and load-balancing cookies. You cannot opt out of these cookies.",
            },
            {
              title: "Preference Cookies",
              desc: "Remember your settings and preferences, such as language and theme selection.",
            },
            {
              title: "Analytics Cookies",
              desc: "Help us understand how users interact with the Platform, which pages are most popular, and what features are most used. We use this data to improve the Platform.",
            },
            {
              title: "Functional Cookies",
              desc: "Enable enhanced functionality, such as remembering your login state across sessions.",
            },
          ].map((item) => (
            <div key={item.title} className="flex items-start gap-3 p-3 rounded-lg bg-white border border-gray-100 shadow-sm">
              <div className="flex-shrink-0 w-2 h-2 rounded-full bg-amber-500 mt-2" />
              <div>
                <h4 className="text-sm font-bold text-gray-800">{item.title}</h4>
                <p className="text-xs text-gray-600 mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <h4 className="text-sm font-bold text-gray-800 mb-2 mt-6">Managing Cookies</h4>
        <p className="text-sm text-gray-600 mb-4">
          Most web browsers allow you to control cookies through your browser settings. You can
          block or delete cookies, but please note that disabling essential cookies may affect the
          functionality of the Platform.
        </p>
        <p className="text-sm text-gray-600">
          We do not use cookies for targeted advertising, and we do not allow third-party
          advertising cookies on our Platform.
        </p>
      </>
    ),
  },
  {
    id: "international-transfers",
    icon: Globe,
    title: "International Data Transfers",
    content: (
      <>
        <p className="mb-4">
          Your information may be transferred to, stored, and processed in countries other than
          the one in which you reside, including the United States (where our hosting providers are
          located) and Nigeria (where we are established).
        </p>
        <p className="mb-4">
          When we transfer personal data across borders, we ensure appropriate safeguards are in
          place, including:
        </p>
        <ul className="space-y-2">
          {[
            "Standard contractual clauses approved by relevant data protection authorities",
            "Data processing agreements with our service providers that include data protection obligations",
            "Ensuring that the receiving jurisdiction provides an adequate level of data protection as determined by applicable law",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-gray-600">
              <ChevronRight className="h-3.5 w-3.5 text-blue-500 mt-1 flex-shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </>
    ),
  },
  {
    id: "third-party-links",
    icon: AlertTriangle,
    title: "Third-Party Links and Services",
    content: (
      <>
        <p className="text-sm text-gray-600">
          The Platform may contain links to third-party websites, plugins, or services that are
          not owned or controlled by us. This includes payment gateways (Paystack), maps, and
          other embedded services. We are not responsible for the privacy practices of these third
          parties. We encourage you to review the privacy policies of any third-party services you
          interact with through the Platform.
        </p>
      </>
    ),
  },
  {
    id: "changes",
    icon: RefreshCw,
    title: "Changes to This Privacy Policy",
    content: (
      <>
        <p className="mb-4">
          We may update this Privacy Policy from time to time to reflect changes in our practices,
          legal requirements, or operational needs. We will notify you of any material changes by:
        </p>
        <ul className="space-y-2 mb-4">
          {[
            "Posting the updated Privacy Policy on this page with a new effective date",
            "Sending an email notification to account administrators",
            "Displaying a prominent notice on the Platform",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-gray-600">
              <ChevronRight className="h-3.5 w-3.5 text-blue-500 mt-1 flex-shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-gray-600">
          We encourage you to review this Privacy Policy periodically. Your continued use of the
          Platform after any changes constitutes your acceptance of the updated policy.
        </p>
      </>
    ),
  },
  {
    id: "contact",
    icon: Mail,
    title: "Contact Us",
    content: (
      <>
        <p className="mb-4">
          If you have any questions, concerns, or requests regarding this Privacy Policy or our
          data practices, please contact us at:
        </p>

        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 p-6 mb-4">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
                <Mail className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</p>
                <a href="mailto:hello@schhub.app" className="text-sm font-bold text-blue-700 hover:text-blue-800 transition-colors">
                  hello@schhub.app
                </a>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
                <Phone className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Phone</p>
                <p className="text-sm font-bold text-gray-700">+1 (555) 123-4567</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
                <MapPin className="h-4.5 w-4.5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Address</p>
                <p className="text-sm text-gray-700">
                  123 Education Ave, Suite 200<br />
                  San Francisco, CA 94105
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 leading-relaxed">
              <p className="font-semibold mb-1">Data Protection Officer (DPO)</p>
              <p>
                For data protection-related inquiries, you may also contact our Data Protection
                Officer at <a href="mailto:dpo@schhub.app" className="font-bold underline underline-offset-2 hover:text-amber-900">dpo@schhub.app</a>.
              </p>
              <p className="mt-2">
                If you are in Nigeria and wish to lodge a complaint regarding our handling of
                your data, you may contact the Nigeria Data Protection Commission (NDPC).
              </p>
            </div>
          </div>
        </div>
      </>
    ),
  },
];

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* ── Navigation ── */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-gray-200/60 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-400 shadow-md group-hover:shadow-lg transition-all duration-300 group-hover:scale-105">
                <GraduationCap className="h-4 w-4 text-white" />
              </div>
              <span className="text-base font-bold tracking-tight text-gray-900">
                School Hub
              </span>
            </Link>
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Home
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative pt-16 pb-12 sm:pt-20 sm:pb-16 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-blue-50/80 to-indigo-50/80 blur-3xl" />
          <div className="absolute -bottom-20 -left-40 w-[400px] h-[400px] rounded-full bg-gradient-to-tr from-emerald-50/60 to-cyan-50/60 blur-3xl" />
        </div>
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-100 mb-6">
            <Shield className="h-3.5 w-3.5 text-blue-500" />
            <span className="text-xs font-medium text-blue-700">Effective Date: July 11, 2026</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 mb-4">
            Privacy Policy
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">
            How we collect, use, disclose, and safeguard your information when you use the School
            Hub platform.
          </p>
        </div>
      </section>

      {/* ── Content ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 sm:pb-28">
        <div className="lg:grid lg:grid-cols-[240px_1fr] lg:gap-10">
          {/* ── Sidebar Navigation ── */}
          <nav className="hidden lg:block sticky top-20 self-start max-h-[calc(100vh-6rem)] overflow-y-auto pr-4">
            <div className="space-y-0.5 border-l-2 border-gray-100 pl-4">
              {sections.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="group flex items-center gap-2 py-1.5 text-xs font-medium text-gray-500 hover:text-blue-600 transition-colors duration-150"
                >
                  <section.icon className="h-3 w-3 flex-shrink-0 opacity-50 group-hover:opacity-100 transition-opacity" />
                  <span>{section.title}</span>
                </a>
              ))}
            </div>
          </nav>

          {/* ── Main Content ── */}
          <div className="min-w-0">
            <div className="max-w-3xl space-y-10">
              {sections.map((section, index) => {
                const Icon = section.icon;
                return (
                  <section
                    key={section.id}
                    id={section.id}
                    className="scroll-mt-24"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-sm">
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
                          Section {String(index + 1).padStart(2, "0")}
                        </span>
                        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                          {section.title}
                        </h2>
                      </div>
                    </div>
                    <div className="pl-[3.25rem]">
                      <div className="prose prose-sm prose-gray max-w-none">
                        {section.content}
                      </div>
                    </div>
                  </section>
                );
              })}
            </div>

            {/* ── Footer note ── */}
            <div className="mt-16 pt-8 border-t border-gray-100 max-w-3xl">
              <p className="text-xs text-gray-400 text-center">
                &copy; {new Date().getFullYear()} School Hub. All rights reserved. |{" "}
                <Link href="/" className="text-gray-500 hover:text-gray-700 transition-colors underline underline-offset-2">
                  Home
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper to avoid missing import since lucide doesn't export BarChart directly for this usage

