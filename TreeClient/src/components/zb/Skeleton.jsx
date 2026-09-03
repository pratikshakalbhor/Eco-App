import React from "react";

const Skeleton = ({ className = "" }) => (
  <div className={`bg-zb-card animate-pulse rounded-xl ${className}`} />
);

export const SkeletonCard = ({ className = "" }) => (
  <div className={`bg-zb-card border border-zb-border rounded-2xl p-5 ${className}`}>
    <div className="flex items-start justify-between mb-4">
      <Skeleton className="w-10 h-10 rounded-xl" />
      <Skeleton className="w-16 h-4 rounded-lg" />
    </div>
    <Skeleton className="w-24 h-3 rounded-lg mb-2" />
    <Skeleton className="w-16 h-8 rounded-lg mb-1" />
    <Skeleton className="w-32 h-3 rounded-lg" />
  </div>
);

export const SkeletonTable = ({ rows = 5, cols = 5, className = "" }) => (
  <div className={`bg-zb-card border border-zb-border rounded-2xl overflow-hidden ${className}`}>
    <div className="px-5 py-4 border-b border-zb-border flex gap-4">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} className="h-3 rounded-lg flex-1" />
      ))}
    </div>
    {Array.from({ length: rows }).map((_, r) => (
      <div key={r} className="px-5 py-3.5 flex gap-4 border-b border-zb-border last:border-0">
        {Array.from({ length: cols }).map((_, c) => (
          <Skeleton key={c} className="h-3 rounded-lg flex-1" />
        ))}
      </div>
    ))}
  </div>
);

export const SkeletonScore = ({ className = "" }) => (
  <div className={`bg-zb-card border border-zb-border rounded-2xl p-8 flex flex-col items-center ${className}`}>
    <Skeleton className="w-40 h-40 rounded-full mb-4" />
    <Skeleton className="w-24 h-6 rounded-lg mb-2" />
    <Skeleton className="w-16 h-4 rounded-lg" />
  </div>
);

export default Skeleton;
