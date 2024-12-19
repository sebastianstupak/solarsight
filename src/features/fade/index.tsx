import React, { useEffect, useState } from "react";

type FadeProps = {
  show: boolean;
  onlyFadeOut: boolean;
  children: React.ReactNode;
};

const Fade: React.FC<FadeProps> = ({ show, onlyFadeOut, children }) => {
  const [render, setRender] = useState(show);

  useEffect(() => {
    if (show) setRender(true);
  }, [show]);

  const onAnimationEnd = () => {
    if (!show) setRender(false);
  };

  return (
    render && (
      <div
        className={`h-full w-full absolute inset-0 ${
          show ? (onlyFadeOut ? "" : "animate-fade-in") : "animate-fade-out"
        }`}
        onAnimationEnd={onAnimationEnd}
      >
        {children}
      </div>
    )
  );
};

export default Fade;
