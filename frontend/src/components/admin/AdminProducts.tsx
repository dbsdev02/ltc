import { useEffect, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/site/FormField";
import { errorMessage } from "@/lib/api";
import { adminApi, type AdminProduct } from "@/lib/admin";

const num = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return s === "" ? null : Number(s);
};

export function AdminProducts() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "products"],
    queryFn: adminApi.products,
  });
  if (isLoading) return <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />;
  if (error || !data)
    return <p className="text-sm font-bold text-destructive">{errorMessage(error)}</p>;
  return (
    <div className="space-y-6">
      {data.map((p) => (
        <ProductForm key={p.id} product={p} />
      ))}
    </div>
  );
}

function ProductForm({ product }: { product: AdminProduct }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [formKey, setFormKey] = useState(0);
  useEffect(() => setFormKey((k) => k + 1), [product]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const text = (k: string) => String(f.get(k) ?? "").trim();
    const discountQty = num(f.get("multiUnitMinQty"));
    const discountPct = num(f.get("multiUnitPercent"));
    const body = {
      name: text("name"),
      tagline: text("tagline"),
      category: text("category"),
      description: text("description"),
      sizeLabel: text("sizeLabel"),
      ageRange: text("ageRange"),
      price: num(f.get("price")),
      compareAtPrice: num(f.get("compareAtPrice")),
      multiUnitMinQty: discountQty && discountPct ? discountQty : null,
      multiUnitPercent: discountQty && discountPct ? discountPct : null,
      maxQtyPerOrder: num(f.get("maxQtyPerOrder")) ?? 10,
      isActive: f.get("isActive") === "on",
      variants: product.variants.map((v) => ({
        id: v.id,
        name: text(`v${v.id}-name`),
        scent: text(`v${v.id}-scent`),
        description: text(`v${v.id}-description`),
        icon: text(`v${v.id}-icon`),
        price: num(f.get(`v${v.id}-price`)),
        isActive: f.get(`v${v.id}-active`) === "on",
        stock: num(f.get(`v${v.id}-stock`)) ?? 0,
        lowStockThreshold: num(f.get(`v${v.id}-low`)) ?? 10,
      })),
    };
    setBusy(true);
    try {
      const saved = await adminApi.saveProduct(product.id, body);
      queryClient.setQueryData<AdminProduct[]>(["admin", "products"], (list) =>
        list?.map((p) => (p.id === saved.id ? saved : p)),
      );
      void queryClient.invalidateQueries({ queryKey: ["product"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
      toast.success("Product saved — the shop updates within a minute.");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      key={formKey}
      onSubmit={onSubmit}
      className="space-y-6 rounded-[2rem] border border-border bg-background p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-extrabold">{product.name}</h2>
        <label className="flex items-center gap-2 text-sm font-bold">
          <input type="checkbox" name="isActive" defaultChecked={product.isActive} /> Visible in
          shop
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <input
            className="form-field"
            name="name"
            defaultValue={product.name}
            required
            maxLength={120}
          />
        </Field>
        <Field label="Tagline">
          <input
            className="form-field"
            name="tagline"
            defaultValue={product.tagline}
            maxLength={200}
          />
        </Field>
        <Field label="Category">
          <input
            className="form-field"
            name="category"
            defaultValue={product.category}
            maxLength={120}
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Size">
            <input
              className="form-field"
              name="sizeLabel"
              defaultValue={product.sizeLabel}
              maxLength={40}
            />
          </Field>
          <Field label="Ages">
            <input
              className="form-field"
              name="ageRange"
              defaultValue={product.ageRange}
              maxLength={40}
            />
          </Field>
        </div>
        <Field label="Description" className="sm:col-span-2">
          <textarea
            className="form-field min-h-24"
            name="description"
            defaultValue={product.description}
            maxLength={5000}
          />
        </Field>
      </div>

      <div>
        <h3 className="font-display font-extrabold">Pricing</h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <Field label="Price (₹, incl. taxes)">
            <input
              className="form-field"
              name="price"
              type="number"
              min={0}
              step="0.01"
              defaultValue={product.price}
              required
            />
          </Field>
          <Field label="Was price (₹, optional)">
            <input
              className="form-field"
              name="compareAtPrice"
              type="number"
              min={0}
              step="0.01"
              defaultValue={product.compareAtPrice ?? ""}
            />
          </Field>
          <Field label="Max bottles per order">
            <input
              className="form-field"
              name="maxQtyPerOrder"
              type="number"
              min={1}
              max={100}
              defaultValue={product.maxQtyPerOrder}
            />
          </Field>
          <Field label="Multi-bottle discount: from (bottles)">
            <input
              className="form-field"
              name="multiUnitMinQty"
              type="number"
              min={2}
              max={100}
              defaultValue={product.multiUnitMinQty ?? ""}
            />
          </Field>
          <Field label="…discount (%)">
            <input
              className="form-field"
              name="multiUnitPercent"
              type="number"
              min={0}
              max={90}
              step="0.01"
              defaultValue={product.multiUnitPercent ?? ""}
            />
          </Field>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Leave both discount boxes empty to switch the multi-bottle offer off.
        </p>
      </div>

      <div>
        <h3 className="font-display font-extrabold">Scents & stock</h3>
        <div className="mt-3 space-y-4">
          {product.variants.map((v) => (
            <fieldset key={v.id} className="rounded-3xl border border-border p-4">
              <legend className="px-2 text-sm font-extrabold">
                {v.icon} {v.name}{" "}
                <span className="font-mono text-xs text-muted-foreground">{v.sku}</span>
              </legend>
              <div className="grid gap-3 sm:grid-cols-4">
                <Field label="Stock">
                  <input
                    className="form-field"
                    name={`v${v.id}-stock`}
                    type="number"
                    min={0}
                    defaultValue={v.stock}
                    required
                  />
                </Field>
                <Field label="Low-stock alert at">
                  <input
                    className="form-field"
                    name={`v${v.id}-low`}
                    type="number"
                    min={0}
                    defaultValue={v.lowStockThreshold}
                  />
                </Field>
                <Field label="Own price (₹, optional)">
                  <input
                    className="form-field"
                    name={`v${v.id}-price`}
                    type="number"
                    min={0}
                    step="0.01"
                    defaultValue={v.price ?? ""}
                  />
                </Field>
                <label className="flex items-end gap-2 pb-3 text-sm font-bold">
                  <input type="checkbox" name={`v${v.id}-active`} defaultChecked={v.isActive} />{" "}
                  Show in shop
                </label>
                <Field label="Name">
                  <input
                    className="form-field"
                    name={`v${v.id}-name`}
                    defaultValue={v.name}
                    required
                    maxLength={80}
                  />
                </Field>
                <Field label="Scent line">
                  <input
                    className="form-field"
                    name={`v${v.id}-scent`}
                    defaultValue={v.scent}
                    maxLength={120}
                  />
                </Field>
                <Field label="Emoji">
                  <input
                    className="form-field"
                    name={`v${v.id}-icon`}
                    defaultValue={v.icon}
                    maxLength={16}
                  />
                </Field>
                <Field label="Description" className="sm:col-span-4">
                  <input
                    className="form-field"
                    name={`v${v.id}-description`}
                    defaultValue={v.description}
                    maxLength={1000}
                  />
                </Field>
              </div>
            </fieldset>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Stock goes down automatically when an order is paid (or a COD order is placed) and back up
          if you cancel it. Set stock to 0 to show a scent as sold out.
        </p>
      </div>

      <Button type="submit" size="lg" disabled={busy}>
        {busy && <Loader2 className="size-4 animate-spin" />} SAVE PRODUCT
      </Button>
    </form>
  );
}
