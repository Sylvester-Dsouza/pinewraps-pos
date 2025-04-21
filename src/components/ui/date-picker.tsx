"use client"

import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { formatDate } from "@/lib/utils"

interface DatePickerProps {
  date: Date | undefined
  onSelect: (date: Date | undefined) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  fromDate?: Date
  toDate?: Date
}

export function DatePicker({
  date,
  onSelect,
  placeholder = "Select date",
  className,
  disabled = false,
  fromDate,
  toDate
}: DatePickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4 h-auto",
            !date && "text-muted-foreground",
            className
          )}
          disabled={disabled}
        >
          <CalendarIcon className="mr-2 h-5 w-5" />
          {date ? formatDate(date) : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={onSelect}
          initialFocus
          fromDate={fromDate || new Date()}
          toDate={toDate}
        />
      </PopoverContent>
    </Popover>
  )
}
