import { Suspense } from "react";
import MushafReader from "@/components/hifz/MushafReader";

export default function Page() {
  return (
    <Suspense>
      <MushafReader />
    </Suspense>
  );
}
