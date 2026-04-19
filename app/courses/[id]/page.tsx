"use client";

import { useParams } from "next/navigation";
import DriveCourseEditor from "@/components/DriveCourseEditor";

export default function CoursePage() {
  const { id } = useParams<{ id: string }>();
  return <DriveCourseEditor driveId={id} />;
}
