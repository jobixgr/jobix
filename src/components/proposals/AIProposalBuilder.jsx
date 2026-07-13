import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Sparkles, Loader2, CheckCircle2, ShoppingCart, Trash2, Info } from "lucide-react";
import { InvokeLLM } from "@/api/integrations";

const workTypes = [
  { value: "bathroom", label: "Ανακαίνιση Μπάνιου" },
  { value: "kitchen", label: "Ανακαίνιση Κουζίνας" },
  { value: "painting", label: "Βάψιμο" },
  { value: "flooring", label: "Δάπεδα" },
  { value: "electrical", label: "Ηλεκτρολογικά" },
  { value: "plumbing", label: "Υδραυλικά" },
  { value: "hvac", label: "Κλιματισμός & Θέρμανση" },
  { value: "roofing", label: "Στέγες & Ταράτσες" },
  { value: "garden", label: "Κήπος & Εξωτερικοί Χώροι" },
  { value: "cleaning", label: "Καθαρισμοί" },
  { value: "moving", label: "Μεταφορές" },
  { value: "general", label: "Γενική Ανακαίνιση" },
  { value: "other", label: "Άλλο" }
];

const JSON_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["labor", "material"] },
          description: { type: "string" },
          quantity: { type: "number" },
          unit: { type: "string" },
          unit_price: { type: "number" },
          vat_rate: { type: "number" },
          suggestion: { type: "string" }
        },
        required: ["kind", "description", "quantity", "unit", "unit_price", "vat_rate"]
      }
    }
  },
  required: ["items"]
};

export default function AIProposalBuilder({ open, onClose, onItemsGenerated }) {
  // mode: "describe" (δεν ξέρω τι θέλω) ή "list" (ξέρω, γράφω λίστα)
  const [mode, setMode] = useState("describe");
  const [description, setDescription] = useState("");
  const [workType, setWorkType] = useState("");
  const [itemsList, setItemsList] = useState("");
  const [searchRealProducts, setSearchRealProducts] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedItems, setGeneratedItems] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [error, setError] = useState("");

  const buildPrompt = () => {
    const year = new Date().getFullYear();
    const productInstruction = searchRealProducts
      ? `\nΓια κάθε υλικό (kind: "material"), ψάξε στο διαδίκτυο σε γνωστά ελληνικά καταστήματα (Leroy Merlin, Praktiker, IKEA, Skroutz.gr, e-shop προμηθευτών) ένα συγκεκριμένο, πραγματικό προϊόν/μάρκα που ταιριάζει, και βάλε το όνομα προϊόντος + κατάστημα στο πεδίο 'suggestion' (π.χ. "Μπαταρία μπάνιου Ideal Standard Ceraflex — Leroy Merlin"). Βάσισε την 'unit_price' σε αυτό το πραγματικό προϊόν. ΣΗΜΑΝΤΙΚΟ: οι τιμές είναι ΕΝΔΕΙΚΤΙΚΕΣ εκτιμήσεις, όχι δεσμευτικές.`
      : `\nΔώσε ρεαλιστικές ΕΝΔΕΙΚΤΙΚΕΣ τιμές για την ελληνική αγορά του ${year}.`;

    if (mode === "list") {
      return `Είσαι έμπειρος εργολάβος/προμηθευτής στην Ελλάδα. Ο χρήστης ξέρει ήδη τι θέλει και σου δίνει μια λίστα υλικών ή/και εργασιών. Για ΚΑΘΕ γραμμή της λίστας, δημιούργησε ένα item με ρεαλιστική εκτιμώμενη τιμή.

Λίστα του χρήστη:
${itemsList}

Για κάθε item δώσε: kind ("labor" ή "material"), description (καθαρή περιγραφή), quantity (αν δεν ορίζεται, βάλε λογική ποσότητα π.χ. 1), unit (τεμ., m², m, ώρες, κιλά, L κλπ), unit_price (τιμή/μονάδα ΧΩΡΙΣ ΦΠΑ σε ευρώ), vat_rate (24).${productInstruction}`;
    }

    return `Είσαι έμπειρος εργολάβος στην Ελλάδα. Δημιούργησε λεπτομερή λίστα εργασιών και υλικών για το παρακάτω έργο.

Τύπος έργου: ${workTypes.find(w => w.value === workType)?.label || workType}
Περιγραφή: ${description}

Για κάθε item δώσε: kind ("labor" ή "material"), description (σύντομη περιγραφή), quantity, unit (τεμ., m², m, ώρες κλπ), unit_price (τιμή/μονάδα ΧΩΡΙΣ ΦΠΑ σε ευρώ), vat_rate (24). Δώσε 4-10 items συνολικά, καλύπτοντας και εργασία και υλικά.${productInstruction}`;
  };

  const handleGenerate = async () => {
    setError("");
    if (mode === "describe" && (!description.trim() || !workType)) {
      setError("Συμπληρώστε τύπο έργου και περιγραφή.");
      return;
    }
    if (mode === "list" && !itemsList.trim()) {
      setError("Γράψτε τη λίστα με τα υλικά/εργασίες που θέλετε.");
      return;
    }

    setIsGenerating(true);
    try {
      const response = await InvokeLLM({
        prompt: buildPrompt(),
        response_json_schema: JSON_SCHEMA,
        add_context_from_internet: searchRealProducts,
      });
      const items = (response.items || []).map(it => ({
        kind: it.kind === "material" ? "material" : "labor",
        description: it.description || "",
        quantity: Number(it.quantity) || 1,
        unit: it.unit || "τεμ.",
        unit_price: Number(it.unit_price) || 0,
        vat_rate: Number(it.vat_rate) || 24,
        suggestion: it.suggestion || "",
      }));
      if (items.length === 0) {
        setError("Το AI δεν επέστρεψε αποτελέσματα. Δοκιμάστε πιο αναλυτική περιγραφή.");
      } else {
        setGeneratedItems(items);
        setShowResults(true);
      }
    } catch (e) {
      setError(e.message || "Σφάλμα κατά τη δημιουργία. Δοκιμάστε ξανά.");
    }
    setIsGenerating(false);
  };

  // Επεξεργασία πεδίου item στα αποτελέσματα
  const updateItem = (index, field, value) => {
    setGeneratedItems(prev => prev.map((it, i) => {
      if (i !== index) return it;
      if (field === "quantity" || field === "unit_price" || field === "vat_rate") {
        return { ...it, [field]: value === "" ? "" : Number(value) };
      }
      return { ...it, [field]: value };
    }));
  };

  const removeItem = (index) => {
    setGeneratedItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleUseItems = () => {
    const clean = generatedItems.map(item => ({
      kind: item.kind,
      description: item.suggestion
        ? `${item.description} (${item.suggestion})`
        : item.description,
      quantity: Number(item.quantity) || 1,
      unit: item.unit,
      unit_price: Number(item.unit_price) || 0,
      vat_rate: Number(item.vat_rate) || 24,
    }));
    onItemsGenerated(clean);
    handleClose();
  };

  const handleClose = () => {
    setMode("describe");
    setDescription("");
    setWorkType("");
    setItemsList("");
    setSearchRealProducts(false);
    setGeneratedItems([]);
    setShowResults(false);
    setError("");
    onClose();
  };

  const grandTotal = generatedItems.reduce(
    (sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 gradient-bg rounded-lg flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            Δημιουργία Προσφοράς με AI
          </DialogTitle>
        </DialogHeader>

        {!showResults ? (
          <div className="space-y-5 py-2">
            {/* Επιλογή τρόπου */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setMode("describe")}
                className={`py-2 px-3 rounded-md text-sm font-medium transition ${mode === "describe" ? "bg-white shadow text-slate-900" : "text-slate-600"}`}
              >
                Περιέγραψε το έργο
              </button>
              <button
                type="button"
                onClick={() => setMode("list")}
                className={`py-2 px-3 rounded-md text-sm font-medium transition ${mode === "list" ? "bg-white shadow text-slate-900" : "text-slate-600"}`}
              >
                Ξέρω τι θέλω (λίστα)
              </button>
            </div>

            {mode === "describe" ? (
              <>
                <div>
                  <Label className="text-base font-semibold">Τύπος Έργου</Label>
                  <Select value={workType} onValueChange={setWorkType}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Επιλέξτε τύπο έργου" />
                    </SelectTrigger>
                    <SelectContent>
                      {workTypes.map(type => (
                        <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-base font-semibold">Περιγραφή Έργου</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Π.χ. Πλήρης ανακαίνιση μπάνιου 6m², αλλαγή πλακιδίων, είδη υγιεινής, μπαταρίες, ντουλάπι νιπτήρα..."
                    className="mt-2 h-28"
                  />
                  <p className="text-sm text-slate-500 mt-1">Όσο πιο αναλυτικά, τόσο καλύτερα τα αποτελέσματα.</p>
                </div>
              </>
            ) : (
              <div>
                <Label className="text-base font-semibold">Λίστα υλικών / εργασιών</Label>
                <Textarea
                  value={itemsList}
                  onChange={(e) => setItemsList(e.target.value)}
                  placeholder={"Ένα ανά γραμμή, π.χ.:\nΜπαταρία μπάνιου\n5 σακιά τσιμεντοκονία\nΒαφή πλαστική λευκή 10L\nΤοποθέτηση πλακιδίων 20m²"}
                  className="mt-2 h-40"
                />
                <p className="text-sm text-slate-500 mt-1">Γράψε ό,τι θέλεις — το AI θα βρει προτεινόμενο προϊόν και τιμή για το καθένα.</p>
              </div>
            )}

            <div className="flex items-start space-x-2 p-3 bg-slate-50 rounded-lg">
              <Checkbox id="search-products" checked={searchRealProducts} onCheckedChange={setSearchRealProducts} className="mt-0.5" />
              <Label htmlFor="search-products" className="text-sm font-medium leading-snug">
                Αναζήτηση πραγματικών προϊόντων στο διαδίκτυο (Leroy Merlin, Praktiker, IKEA, Skroutz)
                <span className="block text-xs text-slate-500 font-normal">Βρίσκει συγκεκριμένες μάρκες. Διαρκεί λίγο περισσότερο.</span>
              </Label>
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">{error}</div>
            )}

            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="gradient-bg text-white w-full py-3"
            >
              {isGenerating ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Δημιουργία...</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" /> Δημιούργησε Πρόταση</>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-semibold">Έτοιμη! Έλεγξε και διόρθωσε τιμές/ποσότητες όπως θέλεις.</span>
            </div>

            <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2.5">
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>Οι τιμές είναι <strong>ενδεικτικές εκτιμήσεις</strong> του AI. Άλλαξέ τες με τις πραγματικές σου τιμές πριν τις περάσεις.</span>
            </div>

            {/* Επεξεργάσιμος πίνακας */}
            <div className="space-y-2">
              {generatedItems.map((item, index) => (
                <div key={index} className="bg-white rounded-lg p-3 border space-y-2">
                  <div className="flex items-center gap-2">
                    <Select value={item.kind} onValueChange={(v) => updateItem(index, "kind", v)}>
                      <SelectTrigger className="w-28 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="labor">Εργασία</SelectItem>
                        <SelectItem value="material">Υλικό</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      value={item.description}
                      onChange={(e) => updateItem(index, "description", e.target.value)}
                      className="flex-1 h-8 text-sm"
                      placeholder="Περιγραφή"
                    />
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700 flex-shrink-0" onClick={() => removeItem(index)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-slate-500">Ποσ.</span>
                      <Input type="number" value={item.quantity} onChange={(e) => updateItem(index, "quantity", e.target.value)} className="w-20 h-8 text-sm" />
                    </div>
                    <Input value={item.unit} onChange={(e) => updateItem(index, "unit", e.target.value)} className="w-24 h-8 text-sm" placeholder="μονάδα" />
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-slate-500">€/μον.</span>
                      <Input type="number" value={item.unit_price} onChange={(e) => updateItem(index, "unit_price", e.target.value)} className="w-24 h-8 text-sm" />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-slate-500">ΦΠΑ%</span>
                      <Input type="number" value={item.vat_rate} onChange={(e) => updateItem(index, "vat_rate", e.target.value)} className="w-16 h-8 text-sm" />
                    </div>
                    <span className="ml-auto text-sm font-semibold text-slate-800">
                      €{((Number(item.quantity) || 0) * (Number(item.unit_price) || 0)).toFixed(2)}
                    </span>
                  </div>

                  {item.suggestion && (
                    <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 p-2 rounded-md">
                      <ShoppingCart className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="font-medium">{item.suggestion}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center px-1">
              <span className="text-sm text-slate-500">{generatedItems.length} items (χωρίς ΦΠΑ)</span>
              <span className="text-lg font-bold text-slate-900">Σύνολο: €{grandTotal.toFixed(2)}</span>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowResults(false)} className="flex-1">Πίσω</Button>
              <Button onClick={handleUseItems} disabled={generatedItems.length === 0} className="gradient-bg text-white flex-1">
                Προσθήκη στην Προσφορά
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
