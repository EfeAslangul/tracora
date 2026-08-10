import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useFieldArray, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { submitSetup } from '../features/setup/setup.api';
import type { SetupResult, SetupStatus } from '../features/setup/setup.types';
import { ApiError } from '../services/api-client';

const optionalPrice = z.preprocess(
  (value) => (value === '' || value === undefined ? undefined : Number(value)),
  z.number().min(0).optional(),
);
const setupSchema = z.object({
  products: z
    .array(
      z.object({
        url: z.string().url('Geçerli bir HTTP/HTTPS bağlantısı girin.'),
        targetPrice: optionalPrice,
        notificationsEnabled: z.boolean(),
      }),
    )
    .min(1)
    .max(20),
});

type SetupForm = z.infer<typeof setupSchema>;

export function SetupPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const form = useForm<SetupForm>({
    resolver: zodResolver(setupSchema),
    defaultValues: { products: [{ url: '', targetPrice: undefined, notificationsEnabled: true }] },
  });
  const fields = useFieldArray({ control: form.control, name: 'products' });
  const mutation = useMutation({
    mutationFn: submitSetup,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });

  if (mutation.data) {
    return (
      <SetupResultView
        result={mutation.data}
        onContinue={() => {
          queryClient.setQueryData<SetupStatus>(['setup-status'], (current) =>
            current
              ? { ...current, required: false, completedAt: mutation.data.completedAt }
              : current,
          );
          navigate('/products');
        }}
      />
    );
  }

  const apiError = mutation.error instanceof ApiError ? mutation.error : null;
  return (
    <section className="content narrow" aria-labelledby="setup-title">
      <p className="eyebrow">İlk kurulum</p>
      <h1 id="setup-title">Takip edilecek ürünleri ekleyin</h1>
      <p className="lead">
        1–20 herkese açık ürün bağlantısı ekleyebilirsiniz. İlk kontrol hemen, devamı günde bir kez
        yapılır.
      </p>

      <form className="setup-form" onSubmit={form.handleSubmit((value) => mutation.mutate(value))}>
        {fields.fields.map((field, index) => (
          <fieldset className="url-row" key={field.id}>
            <legend>Ürün {index + 1}</legend>
            <label>
              Ürün bağlantısı
              <input
                type="url"
                placeholder="https://magaza.example/urun"
                {...form.register(`products.${index}.url`)}
              />
            </label>
            {form.formState.errors.products?.[index]?.url && (
              <span className="field-error" role="alert">
                {form.formState.errors.products[index]?.url?.message}
              </span>
            )}
            <label>
              Hedef fiyat (opsiyonel)
              <input
                type="number"
                min="0"
                step="0.01"
                {...form.register(`products.${index}.targetPrice`)}
              />
            </label>
            <label className="checkbox-label">
              <input type="checkbox" {...form.register(`products.${index}.notificationsEnabled`)} />
              Telegram bildirimleri açık
            </label>
            {fields.fields.length > 1 && (
              <button
                className="button secondary"
                type="button"
                onClick={() => fields.remove(index)}
              >
                Satırı kaldır
              </button>
            )}
          </fieldset>
        ))}

        {apiError && (
          <div className="state-card error" role="alert">
            {apiError.message}
          </div>
        )}
        <div className="actions">
          <button
            className="button secondary"
            type="button"
            disabled={fields.fields.length >= 20}
            onClick={() =>
              fields.append({ url: '', targetPrice: undefined, notificationsEnabled: true })
            }
          >
            Başka URL ekle
          </button>
          <button className="button primary" type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Takipler oluşturuluyor…' : 'Takibi başlat'}
          </button>
        </div>
      </form>
    </section>
  );
}

function SetupResultView({ result, onContinue }: { result: SetupResult; onContinue: () => void }) {
  return (
    <section className="content narrow" aria-labelledby="setup-result-title">
      <p className="eyebrow">Kurulum tamamlandı</p>
      <h1 id="setup-result-title">{result.created.length} ürün takibe alındı</h1>
      <div className="result-list success" aria-label="Başarılı ürünler">
        {result.created.map((product) => (
          <p key={product.id}>✓ {product.url}</p>
        ))}
      </div>
      {result.failed.length > 0 && (
        <div className="result-list error" aria-label="Başarısız ürünler">
          <h2>Takip başlatılamayanlar</h2>
          {result.failed.map((failure) => (
            <p key={failure.url}>
              {failure.url}: {failure.message}
            </p>
          ))}
        </div>
      )}
      <button className="button primary" type="button" onClick={onContinue}>
        Ürünlere geç
      </button>
    </section>
  );
}
