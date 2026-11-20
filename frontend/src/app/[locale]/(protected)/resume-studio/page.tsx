import type { Metadata } from "next";
import { getResumeStudioMode } from "@/lib/resumeStudio/feature";
import { ResumeStudioClient } from "./ResumeStudioClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Resume Studio",
  description: "Upload a Word resume, review the parsed fields, and export an ATS-friendly .docx.",
};

export default function ResumeStudioPage() {
  return <ResumeStudioClient mode={getResumeStudioMode()} />;
}
