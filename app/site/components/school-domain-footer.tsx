interface SchoolDomainFooterProps {
  siteSettings: {
    site_title: string;
    secondary_color: string;
  };
}

export function SchoolDomainFooter({ siteSettings }: SchoolDomainFooterProps) {
  return (
    <footer className="bg-slate-950 px-4 pt-16 text-white md:px-6">
      <div className="mx-auto grid max-w-[1200px] gap-10 md:grid-cols-2 xl:grid-cols-4">
        <div>
          <h4 className="text-lg font-bold" style={{ color: siteSettings.secondary_color }}>
            About School
          </h4>
          <ul className="mt-4 space-y-3 text-sm text-white/75">
            <li>
              <a href="#about" className="hover:text-white">
                About Us
              </a>
            </li>
            <li>
              <a href="#programs" className="hover:text-white">
                Programs
              </a>
            </li>
            <li>
              <a href="#facilities" className="hover:text-white">
                Facilities
              </a>
            </li>
            <li>
              <a href="#faculty" className="hover:text-white">
                Faculty
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="text-lg font-bold" style={{ color: siteSettings.secondary_color }}>
            Quick Links
          </h4>
          <ul className="mt-4 space-y-3 text-sm text-white/75">
            <li>
              <a href="#admissions" className="hover:text-white">
                Admissions
              </a>
            </li>
            <li>
              <a href="#news" className="hover:text-white">
                News
              </a>
            </li>
            <li>
              <a href="#gallery" className="hover:text-white">
                Gallery
              </a>
            </li>
            <li>
              <a href="#contact" className="hover:text-white">
                Contact
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="text-lg font-bold" style={{ color: siteSettings.secondary_color }}>
            Resources
          </h4>
          <ul className="mt-4 space-y-3 text-sm text-white/75">
            <li>
              <a href="#" className="hover:text-white">
                Student Portal
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-white">
                Parent Portal
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-white">
                Faculty Login
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-white">
                Downloads
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="text-lg font-bold" style={{ color: siteSettings.secondary_color }}>
            Connect
          </h4>
          <div className="mt-4 flex gap-3">
            {["📘", "🐦", "📷", "🎬"].map((icon) => (
              <a
                key={icon}
                href="#"
                className="flex h-11 w-11 items-center justify-center rounded-full text-lg text-slate-950 transition hover:opacity-90"
                style={{ backgroundColor: siteSettings.secondary_color }}
              >
                {icon}
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-12 border-t border-white/10 py-6 text-center text-sm text-white/70">
        <p>
          &copy; 2026 {siteSettings.site_title}. All rights reserved. |{" "}
          <a href="#" style={{ color: siteSettings.secondary_color }}>
            Privacy Policy
          </a>{" "}
          |{" "}
          <a href="#" style={{ color: siteSettings.secondary_color }}>
            Terms of Service
          </a>
        </p>
      </div>
    </footer>
  );
}
