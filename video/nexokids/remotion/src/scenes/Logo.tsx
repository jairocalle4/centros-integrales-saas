import type React from "react";
import { brand, fontFamily } from "../theme";

// Isotipo "NK" con el índigo de la app (el mismo del video original).
export const Logo: React.FC<{ readonly size: number }> = ({ size }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size * 0.26,
      background: brand.indigo,
      color: "#fff",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily,
      fontWeight: 850,
      fontSize: size * 0.44,
      letterSpacing: "-0.02em",
      boxShadow: "0 24px 60px rgba(79,70,229,0.5)",
    }}
  >
    NK
  </div>
);
