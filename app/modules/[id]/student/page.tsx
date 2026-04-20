import { redirect } from "next/navigation";

export default async function ModuleStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/courses/${id}`);
}
