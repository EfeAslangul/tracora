export function ProductListPage() {
  return (
    <section aria-labelledby="products-title" className="content">
      <div>
        <p className="eyebrow">Sprint 0</p>
        <h1 id="products-title">Ürünler</h1>
        <p>Ürün listesi, API sözleşmesi Sprint 1'de hazır olduğunda burada gösterilecek.</p>
      </div>
      <div className="placeholder" role="status">
        Henüz izlenen ürün yok.
      </div>
    </section>
  );
}
