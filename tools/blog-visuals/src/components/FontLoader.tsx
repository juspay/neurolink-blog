import React from "react";
import { continueRender, delayRender } from "remotion";
import { fontUrls } from "../theme";

export const FontLoader: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loaded, setLoaded] = React.useState(false);
  const [handle] = React.useState(() => delayRender());

  React.useEffect(() => {
    const links = fontUrls.map((url) => {
      const link = document.createElement("link");
      link.href = url;
      link.rel = "stylesheet";
      document.head.appendChild(link);
      return link;
    });

    // Wait for fonts to load
    document.fonts.ready.then(() => {
      setLoaded(true);
      continueRender(handle);
    });

    return () => links.forEach((l) => l.remove());
  }, [handle]);

  if (!loaded) return null;
  return <>{children}</>;
};
