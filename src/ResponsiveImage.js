import React from "react";
import { mediaSrcSet, mediaUrl } from "./raffleApi";

function ResponsiveImage({
  path,
  alt = "",
  sizes = "100vw",
  priority = false,
  loading,
  decoding = "async",
  ...props
}) {
  const srcSet = mediaSrcSet(path);
  return (
    <img
      {...props}
      src={mediaUrl(path)}
      srcSet={srcSet}
      sizes={srcSet ? sizes : undefined}
      alt={alt}
      loading={loading || (priority ? "eager" : "lazy")}
      decoding={decoding}
      fetchPriority={priority ? "high" : undefined}
    />
  );
}

export default ResponsiveImage;
