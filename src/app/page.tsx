import Link from "next/link";

export default async function Home() {
  return (
    <main className="h-full w-full flex flex-col justify-center items-center">
      <h1 className="font-bold text-xl mb-2">Solar Sight</h1>
      <Link href="/dashboard">Go to dashboard</Link>
    </main>
  );
}
