import { redirect } from "next/navigation";
import { dashboardPath, getUserContext } from "@/lib/supabase";
import AdminDashboard from "./admin-dashboard";

export default async function AdminPage() {
  const context = await getUserContext();
  if (!context) redirect("/login");
  if (context.role !== "admin") redirect(dashboardPath(context.role));
  return <AdminDashboard name={context.fullName} />;
}
