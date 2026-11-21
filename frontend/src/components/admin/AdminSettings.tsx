import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/site/FormField";
import { errorMessage } from "@/lib/api";
import { adminApi, type StoreSettings } from "@/lib/admin";

const num = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return s === "" ? null : Number(s);
};

export function AdminSettings() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: adminApi.settings,
  });
  const [busy, setBusy] = useState(false);

  if (isLoading) return <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />;
  if (error || !data)
    return <p className="text-sm font-bold text-destructive">{errorMessage(error)}</p>;

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const body: StoreSettings = {
      shippingFee: num(f.get("shippingFee")) ?? 0,
      freeShippingMin: num(f.get("freeShippingMin")),
      codEnabled: f.get("codEnabled") === "on",
      codFee: num(f.get("codFee")) ?? 0,
      codMaxOrderTotal: num(f.get("codMaxOrderTotal")),
    };
    if (
      body.codEnabled &&
      !data.codEnabled &&
      !window.confirm(
        "Turn on Cash on Delivery? Remember to update the 'Why is there no COD?' FAQ.",
      )
    )
      return;
    setBusy(true);
    try {
      const saved = await adminApi.saveSettings(body);
      queryClient.setQueryData(["admin", "settings"], saved);
      void queryClient.invalidateQueries({ queryKey: ["product"] });
      toast.success("Settings saved.");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="max-w-2xl space-y-6 rounded-[2rem] border border-border bg-background p-6"
    >
      <section>
        <h2 className="font-display text-xl font-extrabold">Shipping</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label="Shipping fee (₹)">
            <input
              className="form-field"
              name="shippingFee"
              type="number"
              min={0}
              step="0.01"
              defaultValue={data.shippingFee}
            />
          </Field>
          <Field label="Free shipping from (₹, optional)">
            <input
              className="form-field"
              name="freeShippingMin"
              type="number"
              min={0}
              step="0.01"
              defaultValue={data.freeShippingMin ?? ""}
            />
          </Field>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          A fee of 0 means free shipping on every order.
        </p>
      </section>

      <section>
        <h2 className="font-display text-xl font-extrabold">Cash on delivery</h2>
        <label className="mt-3 flex items-center gap-2 text-sm font-bold">
          <input type="checkbox" name="codEnabled" defaultChecked={data.codEnabled} /> Offer cash on
          delivery at checkout
        </label>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label="COD fee (₹)">
            <input
              className="form-field"
              name="codFee"
              type="number"
              min={0}
              step="0.01"
              defaultValue={data.codFee}
            />
          </Field>
          <Field label="COD only up to order total (₹, optional)">
            <input
              className="form-field"
              name="codMaxOrderTotal"
              type="number"
              min={0}
              step="0.01"
              defaultValue={data.codMaxOrderTotal ?? ""}
            />
          </Field>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          COD orders reserve stock immediately and appear under Orders → COD. Mark them delivered
          once the cash is collected.
        </p>
      </section>

      <Button type="submit" size="lg" disabled={busy}>
        {busy && <Loader2 className="size-4 animate-spin" />} SAVE SETTINGS
      </Button>
    </form>
  );
}
