import type { Metadata } from "next";
import { Probar } from "./Probar";

export const metadata: Metadata = {
  title: "Apuntar · probar frases",
  description: "Prueba qué entiende Apuntar antes de usarlo con el doble toque.",
  robots: { index: false },
};

export default function ProbarPage() {
  return <Probar />;
}
