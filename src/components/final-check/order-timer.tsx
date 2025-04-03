"use client";

import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { Clock } from "lucide-react";

// Simple timer component to show elapsed time since order creation
export default function OrderTimer({ createdAt }: { createdAt: Date }) {
  const [timeText, setTimeText] = useState("");

  useEffect(() => {
    const updateTime = () => {
      try {
        setTimeText(formatDistanceToNow(createdAt, { addSuffix: true }));
      } catch (error) {
        console.error("Error formatting time:", error);
        setTimeText("Unknown time");
      }
    };

    // Update immediately
    updateTime();

    // Then update every minute
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, [createdAt]);

  return (
    <div className="text-sm text-gray-500 flex items-center mt-1">
      <Clock className="w-3 h-3 mr-1" />
      <span>{timeText}</span>
    </div>
  );
}
