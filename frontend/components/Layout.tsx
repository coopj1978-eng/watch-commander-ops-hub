import { Outlet } from "react-router-dom";
import SidebarNav from "./SidebarNav";
import TopBar from "./TopBar";
import PageContainer from "./PageContainer";

export default function Layout() {
  return (
    <div className="min-h-screen">
      <SidebarNav />
      <PageContainer>
        <TopBar />
        <Outlet />
      </PageContainer>
    </div>
  );
}
