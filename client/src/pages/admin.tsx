import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, ShieldCheck, FileText, Plane, Heart, Trophy, Users, Building2, Eye, Globe, ExternalLink as ExternalLinkIcon, } from "lucide-react";
import SEO from "@/components/seo";
import { ClubForm } from "@/components/admin/clubs/ClubForm";
import { TravelForm } from "@/components/admin/travel/TravelForm";
import { ArticleForm } from "@/components/admin/articles/ArticleForm";
import AdminOrganizerRequestsTab from "@/components/admin/OrganizerRequestsTab";
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
      <div className="min-h-screen bg-background font-sans flex flex-col">
        <Navbar />

        <main className="flex-1 flex items-center justify-center px-4 pt-24 md:pt-28 pb-8">
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
        </main>

        <Footer />
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
          validation?.error?.errors?.[0]?.message ||
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

  const activeLabel = isContentTab(activeTab)
  ? RESOURCE_LABELS[activeTab]
  : "Users";

  const deleteLabel = isContentTab(activeTab)
  ? RESOURCE_LABELS[activeTab].slice(0, -1)
  : "User";
 
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
        title="Admin Panel | TennisConnect"
        description="Administration panel."
        canonical="/admin"
        noIndex
      />
      <div className="min-h-screen bg-background font-sans">
        <Navbar />

        <div className="container mx-auto px-4 py-12 mt-16">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl md:text-3xl font-display font-bold">Content Manager</h1>
                <Badge className="bg-primary text-primary-foreground">
                  <ShieldCheck className="w-3 h-3 mr-1" /> Admin
                </Badge>
              </div>
            </div>
            {activeTab !== "users" && activeTab !== "organizer-requests" && (
            <Button
              onClick={openCreate}
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-full px-6 cursor-pointer"
              data-testid="admin-create-button"
            >
              <Plus className="w-4 h-4 mr-2" /> New {activeLabel}
            </Button>
            )}
          </div>

          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as AdminTab)}
          >
            <TabsList className="grid grid-cols-2 md:grid-cols-6 mb-8 w-full max-w-5xl">

              <TabsTrigger
                value="users"
                className="cursor-pointer"
                data-testid="admin-tab-users"
              >
                <Users className="w-4 h-4 mr-2" />
                Users
              </TabsTrigger>

              <TabsTrigger
                value="organizer-requests"
                className="cursor-pointer"
                data-testid="admin-tab-organizer-requests"
              >
                <Trophy className="w-4 h-4 mr-2" />
                Organiser &amp; Sessions
              </TabsTrigger>

              {(Object.keys(RESOURCE_LABELS) as Resource[]).map((r) => {
                const Icon = ICONS[r];

                return (
                  <TabsTrigger
                    key={r}
                    value={r}
                    className="cursor-pointer"
                    data-testid={`admin-tab-${r}`}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {RESOURCE_LABELS[r]}
                  </TabsTrigger>
                );
              })}

            </TabsList>

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
                  <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

                    <Input
                      placeholder="Search clubs..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="md:w-80"
                    />

                    <div className="flex gap-3">

                      <select
                        value={listingFilter}
                        onChange={(e) => setListingFilter(e.target.value)}
                        className="
                          h-10
                          rounded-md
                          border
                          bg-background
                          px-3
                          text-sm
                        "
                      >
                        <option value="all">All Listings</option>
                        <option value="free">Free</option>
                        <option value="featured">Featured</option>
                        <option value="premium">Premium</option>
                      </select>

                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="
                          h-10
                          rounded-md
                          border
                          bg-background
                          px-3
                          text-sm
                        "
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
                        <TableHead>Location</TableHead>
                        <TableHead>Listing</TableHead>
                        <TableHead>Status</TableHead>
                
                        <TableHead className="text-centre">
                          Actions
                        </TableHead>
                
                      </TableRow>
                    </TableHeader>
                
                    <TableBody>
                
                      {paginatedClubs.map((club) => (
                
                        <TableRow key={club.id}>
                
                          <TableCell className="font-medium">
                            {club.name}
                          </TableCell>
                
                          <TableCell>
                            {[club.suburb, club.state]
                              .filter(Boolean)
                              .join(", ")}
                          </TableCell>
                
                          <TableCell>
                
                            <Badge
                              variant={
                                club.listingType === "premium"
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              {club.listingType}
                            </Badge>
                
                          </TableCell>
                
                          <TableCell>
                
                            <Badge
                              variant={
                                club.status === "published"
                                  ? "default"
                                  : "outline"
                              }
                            >
                              {club.status}
                            </Badge>
                
                          </TableCell>
                
                          <TableCell>
                
                            <div className="flex justify-end gap-2">
                
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => openEdit(club)}
                                data-testid={`club-row-edit-btn-${club.id}`}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  setPreviewClub(club);
                                  setPreviewOpen(true);
                                }}
                                data-testid={`club-row-preview-btn-${club.id}`}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>

                              {club.listingType === "premium" &&
                                club.slug && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    asChild
                                    title="View Live Page"
                                    data-testid={`club-row-view-live-btn-${club.id}`}
                                  >
                                    <a
                                      href={`/clubs/${club.slug}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      <ExternalLinkIcon className="w-4 h-4" />
                                    </a>
                                  </Button>
                                )}
                
                              <Button
                                size="icon"
                                variant={
                                  club.status === "published"
                                    ? "default"
                                    : "outline"
                                }
                                onClick={() =>
                                  toggleClubStatus(club)
                                }
                                data-testid={`club-row-toggle-status-btn-${club.id}`}
                              >
                                <Globe className="w-4 h-4" />
                              </Button>
                
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => remove(club)}
                                className="text-destructive"
                                data-testid={`club-row-delete-btn-${club.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                
                            </div>
                
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
                  <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

                    <Input
                      placeholder="Search travel packages..."
                      value={travelSearch}
                      onChange={(e) => setTravelSearch(e.target.value)}
                      className="md:w-80"
                    />

                    <div className="flex gap-3">

                      <select
                        value={travelStatusFilter}
                        onChange={(e) => setTravelStatusFilter(e.target.value)}
                        className="
                          h-10
                          rounded-md
                          border
                          bg-background
                          px-3
                          text-sm
                        "
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
                        <TableHead>Location</TableHead>
                        <TableHead>Status</TableHead>

                        <TableHead className="text-centre">
                          Actions
                        </TableHead>

                      </TableRow>
                    </TableHeader>

                    <TableBody>

                      {paginatedTravel.map((pkg) => (

                        <TableRow key={pkg.id}>

                          <TableCell className="font-medium">
                            {pkg.title}
                          </TableCell>

                          <TableCell>
                            {pkg.destination}
                          </TableCell>

                          <TableCell>

                            <Badge
                              variant={
                                pkg.isActive ? "default" : "outline"
                              }
                            >
                              {pkg.isActive ? "published" : "hidden"}
                            </Badge>

                          </TableCell>

                          <TableCell>

                            <div className="flex justify-end gap-2">

                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => openEdit(pkg)}
                                data-testid={`admin-edit-${pkg.id}`}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>

                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() =>
                                  setLocation(`/admin/travel/${pkg.slug}/preview`)
                                }
                                data-testid={`admin-preview-${pkg.id}`}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>

                              <Button
                                size="icon"
                                variant={
                                  pkg.isActive ? "default" : "outline"
                                }
                                onClick={() =>
                                  toggleTravelStatus(pkg)
                                }
                              >
                                <Globe className="w-4 h-4" />
                              </Button>

                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => remove(pkg)}
                                className="text-destructive"
                                data-testid={`admin-delete-${pkg.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>

                            </div>

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
                  <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

                    <Input
                      placeholder="Search articles..."
                      value={articleSearch}
                      onChange={(e) => setArticleSearch(e.target.value)}
                      className="md:w-80"
                    />

                    <div className="flex gap-3">

                      <select
                        value={articleCategoryFilter}
                        onChange={(e) => setArticleCategoryFilter(e.target.value)}
                        className="
                          h-10
                          rounded-md
                          border
                          bg-background
                          px-3
                          text-sm
                        "
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
                        className="
                          h-10
                          rounded-md
                          border
                          bg-background
                          px-3
                          text-sm
                        "
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
                        <TableHead>Category</TableHead>
                        <TableHead>Status</TableHead>

                        <TableHead className="text-centre">
                          Actions
                        </TableHead>

                      </TableRow>
                    </TableHeader>

                    <TableBody>

                      {paginatedArticles.map((article) => (

                        <TableRow key={article.id}>

                          <TableCell className="font-medium">
                            {article.title}
                          </TableCell>

                          <TableCell>
                            {article.category}
                          </TableCell>

                          <TableCell>

                            <Badge
                              variant={
                                article.isPublished ? "default" : "outline"
                              }
                            >
                              {article.isPublished ? "published" : "draft"}
                            </Badge>

                          </TableCell>

                          <TableCell>

                            <div className="flex justify-end gap-2">

                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => openEdit(article)}
                                data-testid={`admin-edit-${article.id}`}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>

                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() =>
                                  setLocation(`/admin/articles/${article.slug}/preview`)
                                }
                                data-testid={`admin-preview-${article.id}`}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>

                              <Button
                                size="icon"
                                variant={
                                  article.isPublished ? "default" : "outline"
                                }
                                onClick={() =>
                                  toggleArticleStatus(article)
                                }
                              >
                                <Globe className="w-4 h-4" />
                              </Button>

                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => remove(article)}
                                className="text-destructive"
                                data-testid={`admin-delete-${article.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>

                            </div>

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
                      <h3 className="text-xl font-bold mb-2">
                        No items yet
                      </h3>
  
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
                              className="flex-1 cursor-pointer"
                              onClick={() => openEdit(item)}
                              data-testid={`admin-edit-${item.id}`}
                            >
                              <Edit className="w-3 h-3 mr-1" />
                              Edit
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              className="cursor-pointer hover:text-destructive hover:border-destructive"
                              onClick={() => remove(item)}
                              data-testid={`admin-delete-${item.id}`}
                            >
                              <Trash2 className="w-3 h-3" />
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
              <DialogTitle>{editing ? "Edit" : "Create"}{" "} {activeLabel}</DialogTitle>
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
              <Button variant="outline" onClick={() => setDialogOpen(false)} className="cursor-pointer">Cancel</Button>
              <Button onClick={submit} className="bg-primary text-primary-foreground cursor-pointer" data-testid="admin-save-button">
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
                Delete {deleteLabel}
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
        <Footer />
      </div>
    </>
  );
}
