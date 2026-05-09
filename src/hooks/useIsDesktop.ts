import { useEffect, useState } from "react";

export function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(typeof window !== "undefined" ? window.innerWidth >= 980 : false);

  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 980);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return isDesktop;
}