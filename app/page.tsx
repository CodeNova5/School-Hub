"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { School, BookOpen, Users, GraduationCap, Trophy, Calendar, Mail, Phone, MapPin, Facebook, Twitter, Instagram } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { News, Testimonial, Teacher } from '@/lib/types';

export default function HomePage() {
  const [news, setNews] = useState<News[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [featuredTeachers, setFeaturedTeachers] = useState<Teacher[]>([]);

  useEffect(() => {
    async function fetchData() {
      const [newsData, testimonialsData, teachersData] = await Promise.all([
        supabase.from('news').select('*').eq('published', true).order('published_at', { ascending: false }).limit(3),
        supabase.from('testimonials').select('*').eq('published', true).limit(3),
        supabase.from('teachers').select('*').eq('status', 'active').limit(4),
      ]);

      if (newsData.data) setNews(newsData.data);
      if (testimonialsData.data) setTestimonials(testimonialsData.data);
      if (teachersData.data) setFeaturedTeachers(teachersData.data);
    }

    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-50 bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <School className="h-8 w-8 text-blue-600" />
              <span className="text-xl font-bold">Excellence Academy</span>
            </div>
            <nav className="hidden md:flex gap-8">
              <a href="#home" className="text-gray-700 hover:text-blue-600 font-medium">Home</a>
              <a href="#about" className="text-gray-700 hover:text-blue-600 font-medium">About</a>
              <a href="#admissions" className="text-gray-700 hover:text-blue-600 font-medium">Admissions</a>
              <a href="#academics" className="text-gray-700 hover:text-blue-600 font-medium">Academics</a>
              <a href="#staff" className="text-gray-700 hover:text-blue-600 font-medium">Staff</a>
              <a href="#contact" className="text-gray-700 hover:text-blue-600 font-medium">Contact</a>
            </nav>
            <div className="flex gap-2">
              <Link href="/admin">
                <Button variant="outline" size="sm">Admin</Button>
              </Link>
              <Link href="/teacher">
                <Button variant="outline" size="sm">Teacher</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <section id="home" className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 text-white py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-5xl md:text-6xl font-bold mb-6">
              Shaping Tomorrow's Leaders
            </h1>
            <p className="text-xl md:text-2xl mb-8 text-blue-100 max-w-3xl mx-auto">
              Excellence Academy provides world-class education, nurturing young minds to reach their full potential
            </p>
            <div className="flex gap-4 justify-center">
              <Button size="lg" className="bg-white text-blue-600 hover:bg-gray-100">
                Apply Now
              </Button>
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
                Learn More
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section id="about" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">About Excellence Academy</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Founded with a vision to provide exceptional education, we have been nurturing young minds for over two decades
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="text-center">
              <CardContent className="p-8">
                <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
                  <Trophy className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold mb-2">Our Mission</h3>
                <p className="text-gray-600">
                  To empower students with knowledge, skills, and values to become responsible global citizens
                </p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardContent className="p-8">
                <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                  <GraduationCap className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-xl font-bold mb-2">Our Vision</h3>
                <p className="text-gray-600">
                  To be a leading institution recognized for excellence in education and character development
                </p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardContent className="p-8">
                <div className="h-16 w-16 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-4">
                  <BookOpen className="h-8 w-8 text-orange-600" />
                </div>
                <h3 className="text-xl font-bold mb-2">Our Values</h3>
                <p className="text-gray-600">
                  Integrity, excellence, innovation, and inclusivity guide everything we do
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section id="admissions" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl font-bold mb-6">Admissions Open</h2>
              <p className="text-xl text-gray-600 mb-6">
                Join our community of learners and begin your journey to excellence. We offer programs from elementary through high school.
              </p>
              <ul className="space-y-4 mb-8">
                <li className="flex items-center gap-3">
                  <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-blue-600 font-bold text-sm">✓</span>
                  </div>
                  <span>Rolling admissions throughout the year</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-blue-600 font-bold text-sm">✓</span>
                  </div>
                  <span>Competitive scholarships available</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-blue-600 font-bold text-sm">✓</span>
                  </div>
                  <span>Simple online application process</span>
                </li>
              </ul>
              <Button size="lg">Apply for Admission</Button>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-8">
              <h3 className="text-2xl font-bold mb-6">Application Requirements</h3>
              <ul className="space-y-4 text-gray-700">
                <li>• Completed application form</li>
                <li>• Previous academic records</li>
                <li>• Birth certificate</li>
                <li>• Passport photographs</li>
                <li>• Parent/guardian information</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section id="academics" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Academic Programs</h2>
            <p className="text-xl text-gray-600">
              Comprehensive curriculum designed to challenge and inspire
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <BookOpen className="h-10 w-10 text-blue-600 mb-4" />
                <h3 className="text-xl font-bold mb-2">Elementary</h3>
                <p className="text-gray-600">Building strong foundations in core subjects</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <BookOpen className="h-10 w-10 text-green-600 mb-4" />
                <h3 className="text-xl font-bold mb-2">Middle School</h3>
                <p className="text-gray-600">Developing critical thinking and creativity</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <BookOpen className="h-10 w-10 text-orange-600 mb-4" />
                <h3 className="text-xl font-bold mb-2">High School</h3>
                <p className="text-gray-600">Advanced preparation for university</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <Trophy className="h-10 w-10 text-red-600 mb-4" />
                <h3 className="text-xl font-bold mb-2">Extra-Curricular</h3>
                <p className="text-gray-600">Sports, arts, and leadership programs</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section id="staff" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Our Faculty</h2>
            <p className="text-xl text-gray-600">
              Experienced educators dedicated to student success
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {featuredTeachers.map((teacher) => (
              <Card key={teacher.id}>
                <CardContent className="p-6 text-center">
                  <div className="h-24 w-24 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl font-bold text-blue-600">
                      {teacher.first_name[0]}{teacher.last_name[0]}
                    </span>
                  </div>
                  <h3 className="font-bold text-lg">{teacher.first_name} {teacher.last_name}</h3>
                  <p className="text-sm text-gray-600">{teacher.specialization || 'Teacher'}</p>
                  <p className="text-xs text-gray-500 mt-2">{teacher.qualification}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {news.length > 0 && (
        <section className="py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold mb-4">Latest News & Events</h2>
              <p className="text-xl text-gray-600">
                Stay updated with what's happening at our school
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {news.map((item) => (
                <Card key={item.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="h-48 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg mb-4 flex items-center justify-center">
                      <Calendar className="h-16 w-16 text-blue-600" />
                    </div>
                    <h3 className="font-bold text-xl mb-2">{item.title}</h3>
                    <p className="text-gray-600 text-sm mb-4">{item.excerpt}</p>
                    <p className="text-xs text-gray-500">
                      {item.published_at && new Date(item.published_at).toLocaleDateString()}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {testimonials.length > 0 && (
        <section className="py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold mb-4">What People Say</h2>
              <p className="text-xl text-gray-600">
                Testimonials from our community
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {testimonials.map((testimonial) => (
                <Card key={testimonial.id}>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-lg font-bold text-blue-600">
                          {testimonial.name[0]}
                        </span>
                      </div>
                      <div>
                        <p className="font-bold">{testimonial.name}</p>
                        <p className="text-sm text-gray-600">{testimonial.role}</p>
                      </div>
                    </div>
                    <p className="text-gray-700 italic">"{testimonial.content}"</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      <section id="contact" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Get in Touch</h2>
            <p className="text-xl text-gray-600">
              We'd love to hear from you
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12">
            <div>
              <Card>
                <CardContent className="p-8">
                  <h3 className="text-2xl font-bold mb-6">Send us a message</h3>
                  <form className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Name</label>
                      <input
                        type="text"
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                        placeholder="Your name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Email</label>
                      <input
                        type="email"
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                        placeholder="your@email.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Message</label>
                      <textarea
                        rows={4}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                        placeholder="Your message..."
                      />
                    </div>
                    <Button className="w-full" size="lg">Send Message</Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                      <MapPin className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-bold">Address</p>
                      <p className="text-gray-600">123 Education Street, City, Country</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                      <Phone className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-bold">Phone</p>
                      <p className="text-gray-600">+1 (234) 567-8900</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                      <Mail className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-bold">Email</p>
                      <p className="text-gray-600">info@excellenceacademy.edu</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <p className="font-bold mb-4">Follow Us</p>
                  <div className="flex gap-4">
                    <a href="#" className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center hover:bg-blue-700">
                      <Facebook className="h-5 w-5 text-white" />
                    </a>
                    <a href="#" className="h-10 w-10 rounded-full bg-blue-400 flex items-center justify-center hover:bg-blue-500">
                      <Twitter className="h-5 w-5 text-white" />
                    </a>
                    <a href="#" className="h-10 w-10 rounded-full bg-pink-600 flex items-center justify-center hover:bg-pink-700">
                      <Instagram className="h-5 w-5 text-white" />
                    </a>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <School className="h-8 w-8" />
                <span className="text-xl font-bold">Excellence Academy</span>
              </div>
              <p className="text-gray-400">
                Empowering students to reach their full potential since 2000.
              </p>
            </div>

            <div>
              <h4 className="font-bold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#about" className="hover:text-white">About Us</a></li>
                <li><a href="#admissions" className="hover:text-white">Admissions</a></li>
                <li><a href="#academics" className="hover:text-white">Academics</a></li>
                <li><a href="#contact" className="hover:text-white">Contact</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-4">Programs</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white">Elementary</a></li>
                <li><a href="#" className="hover:text-white">Middle School</a></li>
                <li><a href="#" className="hover:text-white">High School</a></li>
                <li><a href="#" className="hover:text-white">Extra-Curricular</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-4">Resources</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white">Parent Portal</a></li>
                <li><a href="#" className="hover:text-white">Student Portal</a></li>
                <li><a href="/teacher" className="hover:text-white">Teacher Portal</a></li>
                <li><a href="/admin" className="hover:text-white">Admin Portal</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 mt-12 pt-8 text-center text-gray-400">
            <p>&copy; {new Date().getFullYear()} Excellence Academy. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
