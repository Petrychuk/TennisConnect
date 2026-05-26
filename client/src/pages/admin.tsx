import { useEffect, useState } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, ShieldCheck, FileText, Plane, Heart, Trophy } from "lucide-react";

type Resource = "articles" | "travel" | "recreation" | "event-tournaments";

const RESOURCE_LABELS: Record<Resource, string> = {
  articles: "Articles",
  travel: "Travel Packages",
  recreation: "Recreation Services",
  "event-tournaments": "Tournaments",
};

const ICONS: Record<Resource, any> = {
  articles: FileText,
  travel: Plane,
  recreation: Heart,
  "event-tournaments": Trophy,
};

// Field definitions per resource
const FIELDS: Record<Resource, { name: string; type: "text" | "textarea" | "number" | "list"; required?: boolean; help?: string }[]> = {
  articles: [
    { name: "title", type: "text", required: true },
    { name: "category", type: "text", required: true, help: "Training | Equipment | Health | News" },
    { name: "author", type: "text", required: true },
    { name: "excerpt", type: "textarea", required: true },
    { name: "content", type: "textarea", required: true },
    { name: "coverImage", type: "text", required: true, help: "Image URL" },
    { name: "readTime", type: "number", help: "Minutes" },
  ],
  travel: [
    { name: "title", type: "text", required: true },
    { name: "destination", type: "text", required: true },
    { name: "duration", type: "text", required: true, help: "e.g. 7 days" },
    { name: "price", type: "number", required: true },
    { name: "currency", type: "text", help: "AUD" },
    { name: "description", type: "textarea", required: true },
    { name: "highlights", type: "list", help: "Comma separated" },
    { name: "includes", type: "list", help: "Comma separated" },
    { name: "coverImage", type: "text", required: true, help: "Image URL" },
    { name: "startDate", type: "text", help: "YYYY-MM-DD" },
    { name: "spotsLeft", type: "number" },
  ],
  recreation: [
    { name: "name", type: "text", required: true },
    { name: "type", type: "text", required: true, help: "Massage | Recovery | Yoga | Physio" },
    { name: "provider", type: "text", required: true },
    { name: "location", type: "text", required: true },
    { name: "duration", type: "text", required: true, help: "e.g. 60 min" },
    { name: "price", type: "number", required: true },
    { name: "currency", type: "text" },
    { name: "description", type: "textarea", required: true },
    { name: "benefits", type: "list", help: "Comma separated" },
    { name: "coverImage", type: "text", required: true, help: "Image URL" },
    { name: "rating", type: "text" },
    { name: "phone", type: "text" },
    { name: "email", type: "text" },
  ],
  "event-tournaments": [
    { name: "name", type: "text", required: true },
    { name: "startDate", type: "text", required: true, help: "YYYY-MM-DD" },
    { name: "endDate", type: "text", help: "YYYY-MM-DD" },
    { name: "location", type: "text", required: true },
    { name: "address", type: "text" },
    { name: "level", type: "text", required: true, help: "Beginner | Intermediate | Advanced" },
    { name: "price", type: "number", required: true },
    { name: "prizePool", type: "text" },
    { name: "maxParticipants", type: "number" },
    { name: "currentParticipants", type: "number" },
    { name: "description", type: "textarea", required: true },
    { name: "organizer", type: "text", required: true },
    { name: "phone", type: "text" },
    { name: "email", type: "text" },
    { name: "website", type: "text" },
    { name: "coverImage", type: "text", required: true },
    { name: "status", type: "text", required: true, help: "upcoming | past" },
    { name: "categories", type: "list" },
    { name: "ageGroups", type: "list" },
    { name: "winner", type: "text" },
    { name: "finalist", type: "text" },
  ],
};

export default function AdminPage() {
  const { user, isAuthenticated, loading: isLoading } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<Resource>("articles");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [dialogOpen, setDialogOpen] = useState(false);

  const isAdmin = !!user?.isAdmin;

  const fetchItems = async (resource: Resource) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/${resource}`, { credentials: "include" });
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    if (isAdmin) fetchItems(activeTab);
  }, [activeTab, isAdmin]);

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
        <div className="flex-1 flex items-center justify-center px-4">
          <Card className="max-w-md w-full">
            <CardContent className="p-8 text-center">
              <ShieldCheck className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-2xl font-bold mb-2">Admin Access Required</h2>
              <p className="text-muted-foreground">
                {isAuthenticated ? "You don't have admin privileges." : "Please sign in with an admin account."}
              </p>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  const openCreate = () => {
    setEditing(null);
    const blank: Record<string, any> = {};
    FIELDS[activeTab].forEach((f) => (blank[f.name] = ""));
    setFormData(blank);
    setDialogOpen(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    const data: Record<string, any> = {};
    FIELDS[activeTab].forEach((f) => {
      const v = item[f.name];
      if (f.type === "list") data[f.name] = Array.isArray(v) ? v.join(", ") : (v || "");
      else data[f.name] = v ?? "";
    });
    setFormData(data);
    setDialogOpen(true);
  };

  const submit = async () => {
    const payload: Record<string, any> = {};
    FIELDS[activeTab].forEach((f) => {
      let v = formData[f.name];
      if (v === "" || v === undefined || v === null) return;
      if (f.type === "number") v = Number(v);
      if (f.type === "list") v = String(v).split(",").map((s) => s.trim()).filter(Boolean);
      payload[f.name] = v;
    });

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
      toast({ title: editing ? "Updated" : "Created", description: `${RESOURCE_LABELS[activeTab]} saved successfully.` });
      setDialogOpen(false);
      fetchItems(activeTab);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const remove = async (item: any) => {
    if (!confirm(`Delete "${item.title || item.name}"?`)) return;
    try {
      const res = await fetch(`/api/admin/${activeTab}/${item.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Delete failed");
      toast({ title: "Deleted" });
      fetchItems(activeTab);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const ActiveIcon = ICONS[activeTab];

  return (
    <div className="min-h-screen bg-background font-sans">
      <Navbar />

      <div className="container mx-auto px-4 py-12 mt-16">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <Badge className="mb-3 bg-primary text-primary-foreground">
              <ShieldCheck className="w-3 h-3 mr-1" /> Admin
            </Badge>
            <h1 className="text-4xl md:text-5xl font-display font-bold">Content Manager</h1>
            <p className="text-muted-foreground mt-2">Manage articles, travel, recreation and tournaments.</p>
          </div>
          <Button
            onClick={openCreate}
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-full px-6 cursor-pointer"
            data-testid="admin-create-button"
          >
            <Plus className="w-4 h-4 mr-2" /> New {RESOURCE_LABELS[activeTab]}
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Resource)}>
          <TabsList className="grid grid-cols-2 md:grid-cols-4 mb-8 w-full max-w-3xl">
            {(Object.keys(RESOURCE_LABELS) as Resource[]).map((r) => {
              const Icon = ICONS[r];
              return (
                <TabsTrigger key={r} value={r} className="cursor-pointer" data-testid={`admin-tab-${r}`}>
                  <Icon className="w-4 h-4 mr-2" /> {RESOURCE_LABELS[r]}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {(Object.keys(RESOURCE_LABELS) as Resource[]).map((r) => (
            <TabsContent key={r} value={r}>
              {loading ? (
                <div className="text-center py-12 text-muted-foreground">Loading…</div>
              ) : items.length === 0 ? (
                <div className="text-center py-20">
                  <ActiveIcon className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-xl font-bold mb-2">No items yet</h3>
                  <Button onClick={openCreate} variant="outline">Create first {RESOURCE_LABELS[r].toLowerCase()}</Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map((item) => (
                    <Card key={item.id} className="overflow-hidden">
                      <div className="aspect-[16/9] bg-secondary/50 overflow-hidden">
                        <img src={item.coverImage} alt="" className="w-full h-full object-cover" />
                      </div>
                      <CardContent className="p-4">
                        <h3 className="font-bold text-base mb-1 line-clamp-1">{item.title || item.name}</h3>
                        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{item.excerpt || item.description}</p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 cursor-pointer"
                            onClick={() => openEdit(item)}
                            data-testid={`admin-edit-${item.id}`}
                          >
                            <Edit className="w-3 h-3 mr-1" /> Edit
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
        </Tabs>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit" : "Create"} {RESOURCE_LABELS[activeTab]}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {FIELDS[activeTab].map((f) => (
              <div key={f.name}>
                <Label htmlFor={f.name} className="capitalize">
                  {f.name.replace(/([A-Z])/g, " $1")}
                  {f.required && <span className="text-destructive ml-1">*</span>}
                </Label>
                {f.type === "textarea" ? (
                  <Textarea
                    id={f.name}
                    value={formData[f.name] || ""}
                    onChange={(e) => setFormData({ ...formData, [f.name]: e.target.value })}
                    rows={5}
                    data-testid={`admin-field-${f.name}`}
                  />
                ) : (
                  <Input
                    id={f.name}
                    type={f.type === "number" ? "number" : "text"}
                    value={formData[f.name] || ""}
                    onChange={(e) => setFormData({ ...formData, [f.name]: e.target.value })}
                    data-testid={`admin-field-${f.name}`}
                  />
                )}
                {f.help && <p className="text-xs text-muted-foreground mt-1">{f.help}</p>}
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="cursor-pointer">Cancel</Button>
            <Button onClick={submit} className="bg-primary text-primary-foreground cursor-pointer" data-testid="admin-save-button">
              {editing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
}
