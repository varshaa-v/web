import { redirect } from "next/navigation";
import { dashboardPath, getUserContext } from "@/lib/supabase";
import StaffDashboard from "./staff-dashboard";

export default async function StaffPage() {
  const context = await getUserContext();
  if (!context) redirect("/login");
  if (context.role !== "staff") redirect(dashboardPath(context.role));
  return <StaffDashboard name={context.fullName} />;
}
