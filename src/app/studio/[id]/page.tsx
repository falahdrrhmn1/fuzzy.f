import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Studio } from '../../../components/Studio';
import { getProduct, PRODUCTS } from '../../../data/products';

export function generateStaticParams() {
  return PRODUCTS.map((p) => ({ id: p.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const p = getProduct((await params).id);
  return { title: p ? `${p.name} — Fuzzy Flo 3D` : 'Fuzzy Flo 3D' };
}

export default async function StudioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!getProduct(id)) notFound();
  return <Studio initialProductId={id} />;
}
