import { OrganiserBarLogo } from "@/components/organiser/ui/organiser-bar-logo";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { OrganiserSidebarNav } from "@/components/organiser/ui/organiser-sidebar";
import { useSidebarCollapsed } from "@/lib/use-sidebar-collapsed";
import { NotificationBell } from "@/components/organiser/ui/notification-bell";
import { OrganiserMobileNav } from "@/components/organiser/ui/organiser-mobile-nav";
import { mockOrganiser } from "@/lib/organiser-hub-mock-data";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminRowActions } from "@/components/admin/AdminRowActions";
import { ADMIN_SECTIONS } from "@/lib/adminSections";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, ShieldCheck, FileText, Plane, Heart, Users, Building2 } from "lucide-react";
import SEO from "@/components/seo";
import { ClubForm } from "@/components/admin/clubs/ClubForm";
import { TravelForm } from "@/components/admin/travel/TravelForm";
import { ArticleForm } from "@/components/admin/articles/ArticleForm";
import AdminOrganizerRequestsTab from "@/components/admin/OrganizerRequestsTab";
import { getAdminSessions } from "@/lib/api/organizer-sessions";
import { clubValidationSchema, articleSchema, travelSchema, recreationSchema } from "@/lib/validations";
import AdminUsersTab from "@/components/admin/users_tab";
import { ClubAdminCard } from "@/components/admin/clubs/ClubAdminCard";
import { ClubPreviewDialog } from "@/components/admin/clubs/ClubPreviewDialog";
import { AppPagination } from "@/components/shared/AppPagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";


import {
  type Resource,
  type AdminTab,
  isContentTab,
  RESOURCE_LABELS,
  FIELDS,
} from "@/lib/adminFields";

const ICONS: Record<Resource, any> = {
  clubs: Building2,
  travel: Plane,
  articles: FileText,
  recreation: Heart,
};

const VALID_TABS: AdminTab[] = [
  "users",
  "organizer-requests",
  "clubs",
  "travel",
  "articles",
  "recreation",
];

function getInitialTab(): AdminTab {
  if (typeof window === "undefined") return "users";
  const tab = new URLSearchParams(window.location.search).get("tab");
  return (VALID_TABS as string[]).includes(tab || "")
    ? (tab as AdminTab)
    : "users";
}

function getInitialEditId(param: string): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(param);
}

export default function AdminPage() {
  const { user, isAuthenticated, loading: isLoading } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<AdminTab>(getInitialTab);
  const [sidebarCollapsed, setSidebarCollapsed] = useSidebarCollapsed();
  const urlSearch = useSearch();
  const profileHref = user ? `/${user.role}/${user.slug}` : "/";
  const organiser = user
    ? { ...mockOrganiser, name: user.name, avatar: user.avatar ?? null, isAdmin: user.isAdmin ?? false }
    : mockOrganiser;

  // Admin is now reached from the Organiser Hub sidebar (each item
  // links to /admin?tab=X) rather than a set of horizontal Tabs on
  // this page itself - since /admin always matches the same route
  // regardless of the query string, wouter doesn't remount this
  // component on a sidebar click, so activeTab's own useState(
  // getInitialTab) initializer never re-runs. This keeps it in sync
  // with the URL on every subsequent navigation, the same pattern
  // already used for session-workspace.tsx's own ?tab= and
  // sessions.tsx's own ?bucket=.
  useEffect(() => {
    const requested = new URLSearchParams(urlSearch).get("tab");
    if (requested && (VALID_TABS as string[]).includes(requested)) {
      setActiveTab(requested as AdminTab);
    }
  }, [urlSearch]);

  const [pendingEditTravelId, setPendingEditTravelId] = useState<
    string | null
  >(() => getInitialEditId("editTravel"));
  const [pendingEditArticleId, setPendingEditArticleId] = useState<
    string | null
  >(() => getInitialEditId("editArticle"));
  const ActiveIcon = isContentTab(activeTab)
  ? ICONS[activeTab]
  : Users;

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [editingClubId, setEditingClubId] = useState<string>();
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
 
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  const [clubs, setClubs] = useState<any[]>([]);
  const [previewClub, setPreviewClub] = useState<any>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const isAdmin = !!user?.isAdmin;

  const [search, setSearch] = useState("");
  const [listingFilter, setListingFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [travelSearch, setTravelSearch] = useState("");
  const [travelStatusFilter, setTravelStatusFilter] = useState("all");
  const [travelPage, setTravelPage] = useState(1);

  const [articleSearch, setArticleSearch] = useState("");
  const [articleCategoryFilter, setArticleCategoryFilter] = useState("all");
  const [articleStatusFilter, setArticleStatusFilter] = useState("all");
  const [articlePage, setArticlePage] = useState(1);

  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  // Clean up ?tab=/&editTravel= from the URL once read into state
  // (coming back from the travel preview page's Edit/Back actions).
  useEffect(() => {
    if (window.location.search) {
      window.history.replaceState(null, "", "/admin");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, listingFilter, statusFilter]);

  useEffect(() => {
    setTravelPage(1);
  }, [travelSearch, travelStatusFilter]);

  useEffect(() => {
    setArticlePage(1);
  }, [articleSearch, articleCategoryFilter, articleStatusFilter]);

  const fetchItems = async (resource: Resource) => {
    setLoading(true);
    try {
      const endpoint =
      resource === "articles"
        ? "/api/admin/articles"
        : resource === "travel"
        ? "/api/admin/travel"
        : `/api/${resource}`;
        const res = await fetch(endpoint, {
          credentials: "include",
        });
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setItems(list);
      return list;
    } catch {
      setItems([]);
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  
    if (!isAdmin) return; 
  
    if (!isContentTab(activeTab)) return;

    fetchItems(activeTab).then((data) => {
      if (activeTab === "travel" && pendingEditTravelId) {
        const found = (data || []).find(
          (d: any) => d.id === pendingEditTravelId
        );

        if (found) {
          setEditingClubId(undefined);
          setEditing(found);

          const nextFormData: Record<string, any> = {};
          FIELDS.travel.forEach((f) => {
            const v = found[f.name];
            if (f.type === "list") {
              nextFormData[f.name] = Array.isArray(v) ? v.join(", ") : (v || "");
            } else if (f.type === "checkbox") {
              nextFormData[f.name] = !!v;
            } else {
              nextFormData[f.name] = v ?? "";
            }
          });

          setFormData(nextFormData);
          setDialogOpen(true);
        }

        setPendingEditTravelId(null);
      }

      if (activeTab === "articles" && pendingEditArticleId) {
        const found = (data || []).find(
          (d: any) => d.id === pendingEditArticleId
        );

        if (found) {
          setEditingClubId(undefined);
          setEditing(found);

          const nextFormData: Record<string, any> = {};
          FIELDS.articles.forEach((f) => {
            const v = found[f.name];
            if (f.type === "list") {
              nextFormData[f.name] = Array.isArray(v) ? v.join(", ") : (v || "");
            } else if (f.type === "checkbox") {
              nextFormData[f.name] = !!v;
            } else {
              nextFormData[f.name] = v ?? "";
            }
          });

          setFormData(nextFormData);
          setDialogOpen(true);
        }

        setPendingEditArticleId(null);
      }
    });
  }, [activeTab, isAdmin]);

  useEffect(() => {
    if (activeTab === "clubs") {
  
      loadClubs();  
    }  
  }, [activeTab]);


  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="min-h-screen bg-background font-sans flex flex-col items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 md:p-8 text-center">
            <ShieldCheck className="w-12 h-12 md:w-14 md:h-14 mx-auto text-muted-foreground mb-4" />

            <h2 className="text-xl md:text-2xl font-bold mb-2">
              Admin Access Required
            </h2>

            <p className="text-sm md:text-base text-muted-foreground">
              {isAuthenticated
                ? "You don't have admin privileges."
                : "Please sign in with an admin account."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const openCreate = () => {
    setEditing(null);
    setEditingClubId(undefined);

    const blank: Record<string, any> = {};
    
    if (!isContentTab(activeTab)) return;

    FIELDS[activeTab].forEach((f) => {
      blank[f.name] =
        f.type === "checkbox"
          ? false
          : "";
    });

    setFormData(blank);
    setDialogOpen(true);
  };

  const openEdit = (item: any) => {
    
    if (activeTab === "clubs") {

      setEditingClubId(item.id);
      setDialogOpen(true);
  
      return;  
    }

    setEditing(item);
    const data: Record<string, any> = {};

    if (!isContentTab(activeTab)) return;
    FIELDS[activeTab].forEach((f) => {
      const v = item[f.name];
      if (f.type === "list") data[f.name] = Array.isArray(v) ? v.join(", ") : (v || "");
      else if (f.type === "checkbox") {
          data[f.name] = !!v;
        }
        else {
          data[f.name] = v ?? "";
        }
    });
    setFormData(data);
    setDialogOpen(true);
  };

  const submit = async () => {
    const payload: Record<string, any> = {};

    if (!isContentTab(activeTab)) return;

    FIELDS[activeTab].forEach((f) => {
      let v = formData[f.name];
  
      if (v === "" || v === undefined || v === null) return;
  
      if (f.type === "number") v = Number(v);
  
      if (f.type === "list") {
        v = String(v)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }

      if (f.type === "checkbox") {
        payload[f.name] = !!v;
      } else {
        payload[f.name] = v;
      }
  
    });
  
    // VALIDATION
  
    let validation;
  
    switch (activeTab) {
      case "articles":
        validation = articleSchema.safeParse(payload);
        break;
  
      case "travel":
        validation = travelSchema.safeParse(payload);
        break;
  
      case "recreation":
        validation = recreationSchema.safeParse(payload);
        break;
    }
  
    if (!validation?.success) {
      toast({
        title: "Validation Error",
        description:
          validation?.error?.issues?.[0]?.message ||
          "Invalid form data",
        variant: "destructive",
      });
  
      return;
    }
  
    // EXISTING CODE
    const url = editing
      ? `/api/admin/${activeTab}/${editing.id}`
      : `/api/admin/${activeTab}`;
  
    const method = editing ? "PUT" : "POST";
  
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
  
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Save failed");
      }
  
      toast({
        title: editing ? "Updated" : "Created",
        description: `${RESOURCE_LABELS[activeTab]} saved successfully.`,
      });
  
      setDialogOpen(false);
      fetchItems(activeTab);
  
    } catch (e: any) {
      toast({
        title: "Error",
        description: e.message,
        variant: "destructive",
      });
    }
  };

  const remove = (item: any) => {
    setItemToDelete(item);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
  
    try {
      const res = await fetch(
        `/api/admin/${activeTab}/${itemToDelete.id}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );
  
      if (!res.ok) throw new Error("Delete failed");
  
      toast({
        title: "Deleted successfully",
        description: `"${itemToDelete.title || itemToDelete.name}" has been removed.`,
      });
  
      setDeleteDialogOpen(false);
      setItemToDelete(null);

      if (activeTab === "clubs") {
        await loadClubs();
      } else if (isContentTab(activeTab)) {
        fetchItems(activeTab);
      }
    } catch (e: any) {
      toast({
        title: "Error",
        description: e.message,
        variant: "destructive",
      });
    }
  };

  // Singular item name for dialogs: "article", "package", "club", ...
  const itemLabel = ADMIN_SECTIONS[activeTab].createLabel?.replace(/^New /, "") ?? "user";
 
  // control to close genaral modals window by icon "X"
  const handleDialogClose = () => {

    setEditing(null);
    setEditingClubId(undefined);
  
    setDialogOpen(false);
  
  };

  const loadClubs = async () => {
    try {
      const res = await fetch("/api/admin/clubs", {
        credentials: "include",
      });
  
      if (!res.ok) {
        throw new Error("Failed to load clubs");
      }
  
      const data = await res.json(); 
      setClubs(data);
  
    } catch (err) { 
      console.error(err);
  
    }
  };

  // Func published a new or edit club
  const toggleClubStatus = async (club: any) => {
    try {
      const endpoint =
        club.status === "published"
          ? "unpublish"
          : "publish";
  
      const res = await fetch(
        `/api/admin/clubs/${club.id}/${endpoint}`,
        {
          method: "PATCH",
          credentials: "include",
        }
      );
  
      if (!res.ok) {
        throw new Error("Failed to update status");
      }
  
      const updatedClub = await res.json();
  
      setClubs((prev) =>
        prev.map((c) =>
          c.id === updatedClub.id ? updatedClub : c
        )
      );
  
      if (previewClub?.id === updatedClub.id) {
        setPreviewClub(updatedClub);
      }
  
      toast({
        title:
          updatedClub.status === "published"
            ? "Club Published"
            : "Club Hidden",
        description: updatedClub.name,
      });
  
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Status update failed",
        description: e.message,
      });
    }
  }; 
  
  // Func publish/hide a travel package
  const toggleTravelStatus = async (pkg: any) => {
    try {
      const endpoint = pkg.isActive ? "unpublish" : "publish";

      const res = await fetch(
        `/api/admin/travel/${pkg.id}/${endpoint}`,
        {
          method: "PATCH",
          credentials: "include",
        }
      );

      if (!res.ok) {
        throw new Error("Failed to update status");
      }

      const updatedPkg = await res.json();

      setItems((prev) =>
        prev.map((p) => (p.id === updatedPkg.id ? updatedPkg : p))
      );

      toast({
        title: updatedPkg.isActive ? "Package Published" : "Package Hidden",
        description: updatedPkg.title,
      });
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Status update failed",
        description: e.message,
      });
    }
  };
  
  // Func publish/unpublish an article
  const toggleArticleStatus = async (article: any) => {
    try {
      const endpoint = article.isPublished ? "unpublish" : "publish";

      const res = await fetch(
        `/api/admin/articles/${article.id}/${endpoint}`,
        {
          method: "PATCH",
          credentials: "include",
        }
      );

      if (!res.ok) {
        throw new Error("Failed to update status");
      }

      const updatedArticle = await res.json();

      setItems((prev) =>
        prev.map((a) => (a.id === updatedArticle.id ? updatedArticle : a))
      );

      toast({
        title: updatedArticle.isPublished ? "Article Published" : "Article Unpublished",
        description: updatedArticle.title,
      });
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Status update failed",
        description: e.message,
      });
    }
  };
  
  const filteredClubs = clubs.filter((club) => {
    const matchesSearch =
      club.name.toLowerCase().includes(search.toLowerCase());
  
    const matchesListing =
      listingFilter === "all" ||
      club.listingType === listingFilter;
  
    const matchesStatus =
      statusFilter === "all" ||
      club.status === statusFilter;
  
    return matchesSearch && matchesListing && matchesStatus;
  });
  
  const totalPages = Math.ceil(
    filteredClubs.length / PAGE_SIZE
  );
  
  const paginatedClubs = filteredClubs.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  const filteredTravel = items.filter((pkg) => {
    const q = travelSearch.toLowerCase();
    const matchesSearch =
      !q ||
      (pkg.title || "").toLowerCase().includes(q) ||
      (pkg.destination || "").toLowerCase().includes(q);

    const matchesStatus =
      travelStatusFilter === "all" ||
      (travelStatusFilter === "published" ? !!pkg.isActive : !pkg.isActive);

    return matchesSearch && matchesStatus;
  });

  const travelTotalPages = Math.ceil(
    filteredTravel.length / PAGE_SIZE
  );

  const paginatedTravel = filteredTravel.slice(
    (travelPage - 1) * PAGE_SIZE,
    travelPage * PAGE_SIZE
  );

  const ARTICLE_CATEGORIES =
    FIELDS.articles.find((f) => f.name === "category")?.options || [];

  const filteredArticles = items.filter((a) => {
    const q = articleSearch.toLowerCase();
    const matchesSearch =
      !q ||
      (a.title || "").toLowerCase().includes(q) ||
      (a.excerpt || "").toLowerCase().includes(q);

    const matchesCategory =
      articleCategoryFilter === "all" || a.category === articleCategoryFilter;

    const matchesStatus =
      articleStatusFilter === "all" ||
      (articleStatusFilter === "published" ? !!a.isPublished : !a.isPublished);

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const articleTotalPages = Math.ceil(
    filteredArticles.length / PAGE_SIZE
  );

  const paginatedArticles = filteredArticles.slice(
    (articlePage - 1) * PAGE_SIZE,
    articlePage * PAGE_SIZE
  );

  return (
    <>
      <SEO
        title={`${ADMIN_SECTIONS[activeTab].title} | Admin | TennisConnect`}
        description="Administration panel."
        canonical="/admin"
        noIndex
      />
      <div className="min-h-screen flex bg-background" data-testid="admin-page">
        <aside className={cn("hidden xl:flex shrink-0 border-r border-border sticky top-0 h-screen overflow-y-auto transition-[width] duration-200", sidebarCollapsed ? "xl:w-20" : "xl:w-72")}>
          <OrganiserSidebarNav
            organiser={organiser}
            profileHref={profileHref}
            className="w-full"
            collapsed={sidebarCollapsed}
            onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
          />
        </aside>

        <main id="main-content" className="flex-1 min-w-0 pb-16 md:pb-0">
          {/* Compact bar — tablet & mobile, same pattern as the rest of
              the Organiser Hub */}
          <div className="flex xl:hidden items-center justify-between px-4 h-14 border-b border-border bg-card">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="hidden md:inline-flex" aria-label="Open Organiser Hub menu" data-testid="organiser-sidebar-trigger">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-72">
                <SheetTitle className="sr-only">Organiser Hub navigation</SheetTitle>
                <OrganiserSidebarNav organiser={organiser} profileHref={profileHref} />
              </SheetContent>
            </Sheet>
            <OrganiserBarLogo />
            <div className="hidden md:flex mr-auto items-center gap-1.5 font-display font-bold">Admin</div>
            <div className="flex items-center gap-1">
              <NotificationBell testId="organiser-header-bell-mobile" />
            </div>
          </div>

        <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1500px] mx-auto">
          {/* Titled after the sidebar item that was opened (lib/adminSections.ts). */}
          <AdminPageHeader
            section={activeTab}
            actions={
              ADMIN_SECTIONS[activeTab].createLabel && (
                <Button onClick={openCreate} data-testid="admin-create-button">
                  <Plus aria-hidden="true" /> {ADMIN_SECTIONS[activeTab].createLabel}
                </Button>
              )
            }
          />

          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as AdminTab)}
          >

            {(Object.keys(RESOURCE_LABELS) as Resource[]).map((r) => (
              <TabsContent key={r} value={r}>

                {loading ? (
                  <div className="text-center py-12 text-muted-foreground">
                    Loading…
                  </div>
                 ) : r === "clubs" ? (
                  <>
                  <p className="mb-4 text-sm text-muted-foreground">
                    Showing {filteredClubs.length} club{filteredClubs.length !== 1 ? "s" : ""}
                  </p>
                  <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

                    <Input
                      placeholder="Search clubs..."
                      aria-label="Search clubs"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="md:w-80"
                    />

                    <div className="grid grid-cols-2 gap-3 md:flex">

                      <select
                        value={listingFilter}
                        onChange={(e) => setListingFilter(e.target.value)}
                        aria-label="Filter by listing type"
                        className="h-10 w-full md:w-auto rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <option value="all">All Listings</option>
                        <option value="free">Free</option>
                        <option value="featured">Featured</option>
                        <option value="premium">Premium</option>
                      </select>

                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        aria-label="Filter by status"
                        className="h-10 w-full md:w-auto rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <option value="all">All Statuses</option>
                        <option value="published">Published</option>
                        <option value="hidden">Hidden</option>
                        <option value="draft">Draft</option>
                        <option value="expired">Expired</option>
                      </select>

                    </div>

                  </div>
                  <div className="rounded-xl border bg-card overflow-hidden">

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Club</TableHead>
                        <TableHead className="hidden md:table-cell">Location</TableHead>
                        <TableHead className="hidden lg:table-cell">Listing</TableHead>
                        <TableHead className="hidden sm:table-cell">Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedClubs.map((club) => (
                        <TableRow key={club.id}>
                          <TableCell className="font-medium align-top">
                            {club.name}
                            {/* Narrow screens: the hidden columns, under the name */}
                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs font-normal text-muted-foreground md:hidden">
                              <span>{[club.suburb, club.state].filter(Boolean).join(", ")}</span>
                              <Badge variant={club.listingType === "premium" ? "default" : "secondary"} className="lg:hidden">{club.listingType}</Badge>
                              <Badge variant={club.status === "published" ? "default" : "outline"} className="sm:hidden">{club.status}</Badge>
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {[club.suburb, club.state].filter(Boolean).join(", ")}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <Badge variant={club.listingType === "premium" ? "default" : "secondary"}>{club.listingType}</Badge>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <Badge variant={club.status === "published" ? "default" : "outline"}>{club.status}</Badge>
                          </TableCell>
                          <TableCell className="align-top">
                            <AdminRowActions
                              itemName={club.name}
                              published={club.status === "published"}
                              onEdit={() => openEdit(club)}
                              onPreview={() => {
                                setPreviewClub(club);
                                setPreviewOpen(true);
                              }}
                              liveHref={club.listingType === "premium" && club.slug ? `/clubs/${club.slug}` : undefined}
                              onTogglePublish={() => toggleClubStatus(club)}
                              onDelete={() => remove(club)}
                              testIds={{
                                edit: `club-row-edit-btn-${club.id}`,
                                preview: `club-row-preview-btn-${club.id}`,
                                live: `club-row-view-live-btn-${club.id}`,
                                toggle: `club-row-toggle-status-btn-${club.id}`,
                                delete: `club-row-delete-btn-${club.id}`,
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                
                  
                  <AppPagination
                      currentPage={page}
                      totalPages={totalPages}
                      onPageChange={setPage}
                  />
                  </div>
                  </>
                  
                  ) : r === "travel" ? (
                  <>
                  <p className="mb-4 text-sm text-muted-foreground">
                    Showing {filteredTravel.length} package{filteredTravel.length !== 1 ? "s" : ""}
                  </p>
                  <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

                    <Input
                      placeholder="Search travel packages..."
                      aria-label="Search travel packages"
                      value={travelSearch}
                      onChange={(e) => setTravelSearch(e.target.value)}
                      className="md:w-80"
                    />

                    <div className="grid grid-cols-2 gap-3 md:flex">

                      <select
                        value={travelStatusFilter}
                        onChange={(e) => setTravelStatusFilter(e.target.value)}
                        aria-label="Filter by status"
                        className="h-10 w-full md:w-auto rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <option value="all">All Statuses</option>
                        <option value="published">Published</option>
                        <option value="hidden">Hidden</option>
                      </select>

                    </div>

                  </div>
                  <div className="rounded-xl border bg-card overflow-hidden">

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Package</TableHead>
                        <TableHead className="hidden md:table-cell">Location</TableHead>
                        <TableHead className="hidden sm:table-cell">Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedTravel.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium align-top">
                            {row.title}
                            {/* Narrow screens: the hidden columns, under the title */}
                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs font-normal text-muted-foreground md:hidden">
                              <span>{row.destination}</span>
                              <Badge variant={row.isActive ? "default" : "outline"} className="sm:hidden">{row.isActive ? "published" : "hidden"}</Badge>
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">{row.destination}</TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <Badge variant={row.isActive ? "default" : "outline"}>{row.isActive ? "published" : "hidden"}</Badge>
                          </TableCell>
                          <TableCell className="align-top">
                            <AdminRowActions
                              itemName={row.title}
                              published={!!row.isActive}
                              onEdit={() => openEdit(row)}
                              onPreview={() => setLocation(`/admin/travel/${row.slug}/preview`)}
                              onTogglePublish={() => toggleTravelStatus(row)}
                              onDelete={() => remove(row)}
                              testIds={{
                                edit: `admin-edit-${row.id}`,
                                preview: `admin-preview-${row.id}`,
                                toggle: `admin-toggle-status-${row.id}`,
                                delete: `admin-delete-${row.id}`,
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>


                  <AppPagination
                      currentPage={travelPage}
                      totalPages={travelTotalPages}
                      onPageChange={setTravelPage}
                  />
                  </div>
                  </>

                  ) : r === "articles" ? (
                  <>
                  <p className="mb-4 text-sm text-muted-foreground">
                    Showing {filteredArticles.length} article{filteredArticles.length !== 1 ? "s" : ""}
                  </p>
                  <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

                    <Input
                      placeholder="Search articles..."
                      aria-label="Search articles"
                      value={articleSearch}
                      onChange={(e) => setArticleSearch(e.target.value)}
                      className="md:w-80"
                    />

                    <div className="grid grid-cols-2 gap-3 md:flex">

                      <select
                        value={articleCategoryFilter}
                        onChange={(e) => setArticleCategoryFilter(e.target.value)}
                        aria-label="Filter by category"
                        className="h-10 w-full md:w-auto rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <option value="all">All Categories</option>
                        {ARTICLE_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>

                      <select
                        value={articleStatusFilter}
                        onChange={(e) => setArticleStatusFilter(e.target.value)}
                        aria-label="Filter by status"
                        className="h-10 w-full md:w-auto rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <option value="all">All Statuses</option>
                        <option value="published">Published</option>
                        <option value="draft">Draft</option>
                      </select>

                    </div>

                  </div>
                  <div className="rounded-xl border bg-card overflow-hidden">

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead className="hidden md:table-cell">Category</TableHead>
                        <TableHead className="hidden sm:table-cell">Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedArticles.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium align-top">
                            {row.title}
                            {/* Narrow screens: the hidden columns, under the title */}
                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs font-normal text-muted-foreground md:hidden">
                              <span>{row.category}</span>
                              <Badge variant={row.isPublished ? "default" : "outline"} className="sm:hidden">{row.isPublished ? "published" : "draft"}</Badge>
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">{row.category}</TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <Badge variant={row.isPublished ? "default" : "outline"}>{row.isPublished ? "published" : "draft"}</Badge>
                          </TableCell>
                          <TableCell className="align-top">
                            <AdminRowActions
                              itemName={row.title}
                              published={!!row.isPublished}
                              onEdit={() => openEdit(row)}
                              onPreview={() => setLocation(`/admin/articles/${row.slug}/preview`)}
                              onTogglePublish={() => toggleArticleStatus(row)}
                              onDelete={() => remove(row)}
                              testIds={{
                                edit: `admin-edit-${row.id}`,
                                preview: `admin-preview-${row.id}`,
                                toggle: `admin-toggle-status-${row.id}`,
                                delete: `admin-delete-${row.id}`,
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>


                  <AppPagination
                      currentPage={articlePage}
                      totalPages={articleTotalPages}
                      onPageChange={setArticlePage}
                  />
                  </div>
                  </>

                    ) : items.length === 0 ? (
                    <div className="text-center py-20">
                      <ActiveIcon className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                      <h2 className="text-xl font-bold mb-2">
                        No items yet
                      </h2>
  
                      <Button
                        onClick={openCreate}
                        variant="outline"
                      >
                        Create first {RESOURCE_LABELS[r].toLowerCase()}
                      </Button>
                    </div>
                  ) : (
                                    
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

                    {items.map((item) => (
                      <Card
                        key={item.id}
                        className="overflow-hidden"
                      >
                        <div className="aspect-video bg-secondary/50 overflow-hidden">
                          <img
                            src={item.coverImage}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </div>

                        <CardContent className="p-4">
                          <h3 className="font-bold text-base mb-1 line-clamp-1">
                            {item.title || item.name}
                          </h3>

                          <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                            {item.excerpt || item.description}
                          </p>

                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              onClick={() => openEdit(item)}
                              data-testid={`admin-edit-${item.id}`}
                            >
                              <Edit className="w-3 h-3 mr-1" />
                              Edit
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              className="hover:text-destructive hover:border-destructive"
                              aria-label={`Delete ${item.title || item.name}`}
                              onClick={() => remove(item)}
                              data-testid={`admin-delete-${item.id}`}
                            >
                              <Trash2 className="w-3 h-3" aria-hidden="true" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}

                  </div>
                )}

              </TabsContent>
            ))}

            <TabsContent value="users">
              <AdminUsersTab />
            </TabsContent>

            <TabsContent value="organizer-requests">
              <AdminOrganizerRequestsTab />
            </TabsContent>
          </Tabs>

        </div>
        </main>

        <Dialog 
            open={dialogOpen}
            onOpenChange={(open) => {

              if (open) {
                setDialogOpen(true);
              } else {
                handleDialogClose();
              }
          
            }}
            >
          <DialogContent 
             className="sm:max-w-2xl max-h-[90vh] overflow-y-auto"
             onPointerDownOutside={(e) => e.preventDefault()}
             onEscapeKeyDown={(e) => e.preventDefault()}
             >
            <DialogHeader>
              <DialogTitle>{editing ? "Edit" : "Create"} {itemLabel}</DialogTitle>
            </DialogHeader>
            

            {activeTab === "clubs" ? (

            <ClubForm
              mode={editingClubId ? "edit" : "create"}
              clubId={editingClubId}
              onClose={() => {
                setEditingClubId(undefined);
                setDialogOpen(false)
              }}
              
              onSaved={() => {
                setEditingClubId(undefined);
                setDialogOpen(false);
                loadClubs();
              }}
              />

            ) : activeTab === "travel" ? (

            <TravelForm
              mode={editing ? "edit" : "create"}
              initialData={editing}
              onClose={() => {
                setEditing(null);
                setDialogOpen(false);
              }}
              onSaved={() => {
                setEditing(null);
                setDialogOpen(false);
                fetchItems("travel");
              }}
              />

            ) : activeTab === "articles" ? (

            <ArticleForm
              mode={editing ? "edit" : "create"}
              initialData={editing}
              onClose={() => {
                setEditing(null);
                setDialogOpen(false);
              }}
              onSaved={() => {
                setEditing(null);
                setDialogOpen(false);
                fetchItems("articles");
              }}
              />

            ) : (

              isContentTab(activeTab) &&  (
                <div className="space-y-4">
                {FIELDS[activeTab].map((f) => {

                  if (
                    f.name === "legalType" &&
                    formData.category !== "Legal"
                  ) {
                    return null;
                  }

                  return (
                    <div key={f.name}>
                      <Label htmlFor={f.name} className="capitalize">
                        {f.name.replace(/([A-Z])/g, " $1")}
                        {f.required && (
                          <span className="text-destructive ml-1">*</span>
                        )}
                      </Label>
        
                      {f.type === "textarea" ? (
                        <Textarea
                          id={f.name}
                          value={formData[f.name] || ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              [f.name]: e.target.value,
                            })
                          }
                          rows={5}
                          data-testid={`admin-field-${f.name}`}
                        />
                      ) : f.type === "select" ? (
                        <select
                          id={f.name}
                          value={formData[f.name] || ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              [f.name]: e.target.value,
                            })
                          }
                          className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          <option value="">Select...</option>

                          {f.options?.map((option) => (
                            <option
                              key={option}
                              value={option}
                            >
                              {option}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <Input
                          id={f.name}
                          type={f.type === "number" ? "number" : "text"}
                          value={formData[f.name] || ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              [f.name]: e.target.value,
                            })
                          }
                          data-testid={`admin-field-${f.name}`}
                        />
                      )}

                      {f.help && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {f.help}
                        </p>
                      )}
                    </div>
                  );
                })}
                </div>
               )
              )}
          {activeTab !== "clubs" && activeTab !== "travel" && activeTab !== "articles" && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={submit} data-testid="admin-save-button">
                {editing ? "Update" : "Create"}
              </Button>
            </DialogFooter>
           )}
          </DialogContent>
        </Dialog>
        <Dialog
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
          >
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>
                Delete {itemLabel}
                </DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete
                  <strong>
                    {" "}
                    "{itemToDelete?.title || itemToDelete?.name}"
                  </strong>
                  ?
                  <br />
                  This action cannot be undone.
                </DialogDescription>
              </DialogHeader>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setDeleteDialogOpen(false); 
                    setItemToDelete(null); 
                  }}
                >
                  Cancel
                </Button>

                <Button
                  variant="destructive"
                  onClick={confirmDelete}
                >
                  Delete
                </Button>
              </div>
            </DialogContent>
        </Dialog>
        <ClubPreviewDialog
            open={previewOpen}
            club={previewClub}
            onClose={() => {
                setPreviewOpen(false);
                setPreviewClub(null);
            }}
            onEdit={() => {
              setPreviewOpen(false);
          
              setEditingClubId(previewClub.id);
              setDialogOpen(true);
            }}
            onToggleStatus={() => toggleClubStatus(previewClub)}
        />
        <OrganiserMobileNav />
      </div>
    </>
  );
}
