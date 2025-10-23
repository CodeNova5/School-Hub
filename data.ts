// /config/schoolDetails.ts

export interface SchoolInfo {
  name: string;
  motto: string;
  address: string;
  email: string;
  phone: string;
  website?: string;
  logoUrl?: string;
  principalName?: string;
  established?: string;
  themeColor?: string;
}

export const schoolDetails: SchoolInfo = {
  name: "TOSFEB Presidency School",
  motto: "Excellence and Integrity",
  address: "23 School Lane, Lagos, Nigeria",
  email: "codenova02@gmail.com",
  phone: "+234 901 234 5678",
  website: "https://school-hub-five.vercel.app",
  logoUrl: "/images/school-logo.png", // public folder
  principalName: "Mrs. F. Johnson",
  established: "2002",
  themeColor: "#1E40AF", // Tailwind blue-800
};
