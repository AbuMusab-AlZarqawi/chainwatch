import dynamic from "next/dynamic";

const LandingClient = dynamic(() => import("@/components/LandingClient"), {
  ssr: false,
});

export default function Home() {
  return <LandingClient />;
}
