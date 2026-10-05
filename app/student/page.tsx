import { redirect } from "next/navigation";
import { dashboardPath, getUserContext } from "@/lib/supabase";
import StudentDashboard from "./student-dashboard";

export default async function StudentPage() {
  const context = await getUserContext();
  if (!context) redirect("/login");
  if (context.role !== "student") redirect(dashboardPath(context.role));
  return <StudentDashboard name={context.fullName} />;
}
