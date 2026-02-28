"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, FileText } from "lucide-react";

export default function StudentApplicationPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [applicationNumber, setApplicationNumber] = useState("");

  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    date_of_birth: "",
    gender: "",
    address: "",
    parent_name: "",
    parent_email: "",
    parent_phone: "",
    desired_class: "",
    previous_school: "",
    notes: "",
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/admissions/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle rate limit error specifically
        if (response.status === 429) {
          throw new Error(
            "Too many applications from your IP address. Please try again in 1 hour."
          );
        }
        throw new Error(data.error || "Failed to submit application");
      }

      setApplicationNumber(data.applicationNumber);
      setSubmitted(true);
      
      toast({
        title: "Application Submitted Successfully!",
        description: `Your application number is: ${data.applicationNumber}`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Application Submitted Successfully!</CardTitle>
            <CardDescription className="text-lg mt-2">
              Your application has been received and is under review.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm font-medium text-blue-900 mb-1">Application Number</p>
              <p className="text-2xl font-bold text-blue-600">{applicationNumber}</p>
              <p className="text-xs text-blue-700 mt-2">
                Please save this number for future reference.
              </p>
            </div>
            
            <div className="space-y-2 text-sm text-gray-600">
              <p className="flex items-start gap-2">
                <span className="text-blue-600 mt-1">•</span>
                <span>You will receive an email confirmation at <strong>{formData.parent_email}</strong></span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-blue-600 mt-1">•</span>
                <span>The admissions team will review your application within 3-5 business days.</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-blue-600 mt-1">•</span>
                <span>You will be notified of the decision via email.</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-blue-600 mt-1">•</span>
                <span>If approved, you will receive activation instructions for the parent portal.</span>
              </p>
            </div>

            <div className="pt-4 flex gap-3">
              <Button 
                onClick={() => router.push("/")}
                variant="outline"
                className="flex-1"
              >
                Return Home
              </Button>
              <Button 
                onClick={() => {
                  setSubmitted(false);
                  setFormData({
                    first_name: "",
                    last_name: "",
                    email: "",
                    phone: "",
                    date_of_birth: "",
                    gender: "",
                    address: "",
                    parent_name: "",
                    parent_email: "",
                    parent_phone: "",
                    desired_class: "",
                    previous_school: "",
                    notes: "",
                  });
                }}
                className="flex-1"
              >
                Submit Another Application
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <FileText className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Student Admission Application</h1>
          <p className="text-gray-600 text-lg">
            Complete the form below to apply for student admission
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Application Form</CardTitle>
            <CardDescription>
              Please fill in all required fields accurately. Fields marked with * are required.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Student Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
                  Student Information
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">First Name *</Label>
                    <Input
                      id="first_name"
                      name="first_name"
                      value={formData.first_name}
                      onChange={handleInputChange}
                      required
                      placeholder="Enter first name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="last_name">Last Name *</Label>
                    <Input
                      id="last_name"
                      name="last_name"
                      value={formData.last_name}
                      onChange={handleInputChange}
                      required
                      placeholder="Enter last name"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date_of_birth">Date of Birth *</Label>
                    <Input
                      id="date_of_birth"
                      name="date_of_birth"
                      type="date"
                      value={formData.date_of_birth}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="gender">Gender *</Label>
                    <Select
                      value={formData.gender}
                      onValueChange={(value) => handleSelectChange("gender", value)}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Student Email (Optional)</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="student@email.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Student Phone (Optional)</Label>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={handleInputChange}
                      placeholder="+1234567890"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Residential Address *</Label>
                  <Textarea
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    required
                    placeholder="Enter full residential address"
                    rows={3}
                  />
                </div>
              </div>

              {/* Parent/Guardian Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
                  Parent/Guardian Information
                </h3>

                <div className="space-y-2">
                  <Label htmlFor="parent_name">Parent/Guardian Name *</Label>
                  <Input
                    id="parent_name"
                    name="parent_name"
                    value={formData.parent_name}
                    onChange={handleInputChange}
                    required
                    placeholder="Enter parent/guardian full name"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="parent_email">Parent/Guardian Email *</Label>
                    <Input
                      id="parent_email"
                      name="parent_email"
                      type="email"
                      value={formData.parent_email}
                      onChange={handleInputChange}
                      required
                      placeholder="parent@email.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="parent_phone">Parent/Guardian Phone *</Label>
                    <Input
                      id="parent_phone"
                      name="parent_phone"
                      type="tel"
                      value={formData.parent_phone}
                      onChange={handleInputChange}
                      required
                      placeholder="+1234567890"
                    />
                  </div>
                </div>
              </div>

              {/* Academic Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
                  Academic Information
                </h3>

                <div className="space-y-2">
                  <Label htmlFor="desired_class">Desired Class/Grade *</Label>
                  <Input
                    id="desired_class"
                    name="desired_class"
                    value={formData.desired_class}
                    onChange={handleInputChange}
                    required
                    placeholder="e.g., Grade 10, JSS 1, SS 2"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="previous_school">Previous School (Optional)</Label>
                  <Input
                    id="previous_school"
                    name="previous_school"
                    value={formData.previous_school}
                    onChange={handleInputChange}
                    placeholder="Enter previous school name if applicable"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Additional Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    placeholder="Any additional information you'd like to share..."
                    rows={4}
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex gap-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/")}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Application"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}