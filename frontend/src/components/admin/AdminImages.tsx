import { useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, RefreshCw, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/site/FormField";
import { errorMessage } from "@/lib/api";
import { adminApi, type AdminImage, type AdminProduct, type ImageRole } from "@/lib/admin";

const ROLES: { role: ImageRole; label: string; hint: string; perVariant?: boolean }[] = [
  {
    role: "hero",
    label: "Top of page (hero)",
    hint: "Portrait, about 900 × 1350. Replaces the main photo.",
  },
  { role: "what_is", label: '"What is Cloud Mist?"', hint: "Landscape 4:3, about 1200 × 900." },
  {
    role: "scent_slide",
    label: "Scent slider",
    hint: "16:10, about 1280 × 800 — one per scent.",
    perVariant: true,
  },
  {
    role: "badge",
    label: "Scent badge",
    hint: "Square PNG with transparent background — one per scent.",
    perVariant: true,
  },
  { role: "gallery", label: "Gallery", hint: "Extra product photos." },
];

const ACCEPT = "image/jpeg,image/png,image/webp,image/avif";
const MAX_BYTES = 4 * 1024 * 1024;

function checkFile(file: File | undefined | null): string | null {
  if (!file) return "Choose an image first.";
  if (!ACCEPT.split(",").includes(file.type))
    return "Only JPG, PNG, WebP or AVIF images are allowed.";
  if (file.size > MAX_BYTES) return "Images must be 4 MB or smaller — please compress it first.";
  return null;
}

export function AdminImages() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "products"],
    queryFn: adminApi.products,
  });
  if (isLoading) return <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />;
  if (error || !data?.[0])
    return <p className="text-sm font-bold text-destructive">{errorMessage(error)}</p>;
  return <ProductImages product={data[0]} />;
}

function ProductImages({ product }: { product: AdminProduct }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
    void queryClient.invalidateQueries({ queryKey: ["product"] });
  };

  const onUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formEl = event.currentTarget;
    const f = new FormData(formEl);
    const file = f.get("file") as File | null;
    const problem = checkFile(file);
    if (problem) {
      toast.error(problem);
      return;
    }
    const role = String(f.get("role")) as ImageRole;
    const meta = ROLES.find((r) => r.role === role);
    if (meta?.perVariant && !f.get("variant_id")) {
      toast.error("Choose which scent this image is for.");
      return;
    }
    const body = new FormData();
    body.set("file", file as File);
    body.set("product_id", String(product.id));
    body.set("role", role);
    body.set("alt", String(f.get("alt") ?? ""));
    if (f.get("variant_id")) body.set("variant_id", String(f.get("variant_id")));
    setBusy(true);
    try {
      await adminApi.uploadImage(body);
      toast.success("Image uploaded.");
      formEl.reset();
      refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={onUpload}
        className="grid gap-4 rounded-[2rem] border border-border bg-background p-6 sm:grid-cols-2"
      >
        <h2 className="font-display text-xl font-extrabold sm:col-span-2">Upload an image</h2>
        <Field label="Image (JPG, PNG, WebP or AVIF, max 4 MB)" className="sm:col-span-2">
          <input className="form-field" name="file" type="file" accept={ACCEPT} required />
        </Field>
        <Field label="Where it appears">
          <select className="form-field" name="role" defaultValue="hero">
            {ROLES.map((r) => (
              <option key={r.role} value={r.role}>
                {r.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Scent (for slider & badge images)">
          <select className="form-field" name="variant_id" defaultValue="">
            <option value="">—</option>
            {product.variants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Description for screen readers (alt text)" className="sm:col-span-2">
          <input
            className="form-field"
            name="alt"
            maxLength={255}
            placeholder="e.g. A girl holding Cloud Mist Vanilla Cake"
          />
        </Field>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}{" "}
            UPLOAD
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            Until you upload an image for a spot, the shop keeps showing the built-in picture.
          </p>
        </div>
      </form>

      {ROLES.map(({ role, label, hint }) => {
        const images = product.images.filter((i) => i.role === role);
        return (
          <section key={role} className="rounded-[2rem] border border-border bg-background p-6">
            <h3 className="font-display font-extrabold">{label}</h3>
            <p className="text-xs text-muted-foreground">{hint}</p>
            {images.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Using the built-in image.</p>
            ) : (
              <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {images.map((image) => (
                  <ImageCard key={image.id} image={image} product={product} onChange={refresh} />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

function ImageCard({
  image,
  product,
  onChange,
}: {
  image: AdminImage;
  product: AdminProduct;
  onChange: () => void;
}) {
  const [alt, setAlt] = useState(image.alt);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const variant = product.variants.find((v) => v.id === image.variantId);

  const run = async (task: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await task();
      toast.success(success);
      onChange();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const replace = (file: File | undefined) => {
    const problem = checkFile(file);
    if (problem) {
      toast.error(problem);
      return;
    }
    const body = new FormData();
    body.set("file", file as File);
    body.set("product_id", String(product.id));
    body.set("role", image.role);
    body.set("alt", alt);
    body.set("replace_image_id", String(image.id));
    void run(() => adminApi.uploadImage(body), "Image replaced.");
  };

  return (
    <li className="overflow-hidden rounded-3xl border border-border">
      <img
        src={image.url}
        alt={image.alt}
        loading="lazy"
        className="aspect-[4/3] w-full bg-cream object-contain"
      />
      <div className="space-y-2 p-3 text-xs">
        {variant && <p className="font-bold">{variant.name}</p>}
        <input
          className="form-field text-xs"
          value={alt}
          maxLength={255}
          aria-label="Alt text"
          placeholder="Alt text"
          onChange={(e) => setAlt(e.target.value)}
          onBlur={() =>
            alt !== image.alt &&
            void run(() => adminApi.updateImage(image.id, { alt }), "Alt text saved.")
          }
        />
        <div className="flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => replace(e.target.files?.[0])}
          />
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            <RefreshCw className="size-3.5" /> Replace
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() =>
              window.confirm(
                "Delete this image? The shop will go back to the built-in picture if it was the only one.",
              ) && void run(() => adminApi.deleteImage(image.id), "Image deleted.")
            }
          >
            <Trash2 className="size-3.5" /> Delete
          </Button>
          {busy && <Loader2 className="size-4 animate-spin self-center" />}
        </div>
      </div>
    </li>
  );
}
