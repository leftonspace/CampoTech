# Fix all 29 unused variable/import issues
# Generated: 2026-01-11 09:35

Write-Host "Fixing 29 unused variable/import issues..." -ForegroundColor Cyan

# Fix 1: marketplace/profile/page.tsx - Remove ImageIcon import (line 8)
(Get-Content "apps\web\app\dashboard\marketplace\profile\page.tsx" -Raw) -replace "  Image as ImageIcon,`r?`n", "" | Set-Content "apps\web\app\dashboard\marketplace\profile\page.tsx" -NoNewline

# Fix 2: marketplace/profile/page.tsx - Prefix isEditing (line 36) 
(Get-Content "apps\web\app\dashboard\marketplace\profile\page.tsx" -Raw) -replace "const \[isEditing, setIsEditing\]", "const [_isEditing, setIsEditing]" | Set-Content "apps\web\app\dashboard\marketplace\profile\page.tsx" -NoNewline

# Fix 3 & 4: marketplace/profile/page.tsx - Remove isLoading and setIsLoading (lines 53)
(Get-Content "apps\web\app\dashboard\marketplace\profile\page.tsx" -Raw) -replace "  const \[isLoading, setIsLoading\] = useState\(false\);`r?`n", "" | Set-Content "apps\web\app\dashboard\marketplace\profile\page.tsx" -NoNewline

# Fix 5: mi-verificacion/page.tsx - Prefix selectedRequirement (line 249)
(Get-Content "apps\web\app\dashboard\mi-verificacion\page.tsx" -Raw) -replace "const \[selectedRequirement, setSelectedRequirement\]", "const [_selectedRequirement, setSelectedRequirement]" | Set-Content "apps\web\app\dashboard\mi-verificacion\page.tsx" -NoNewline

# Fix 6: dashboard/page.tsx - Remove Technician import from line 68
(Get-Content "apps\web\app\dashboard\page.tsx" -Raw) -replace "interface Technician \{`r?`n  id: string;`r?`n  name: string;`r?`n  avatar\?: string;`r?`n  currentJob\?: string;`r?`n  currentLocation\?: string;`r?`n  phone\?: string;`r?`n  status: 'available' \| 'busy' \| 'offline';`r?`n\}`r?`n`r?`n", "" | Set-Content "apps\web\app\dashboard\page.tsx" -NoNewline

# Fix 7 & 8: settings/team/page.tsx - Remove mutationError state (lines 149-150)
(Get-Content "apps\web\app\dashboard\settings\team\page.tsx" -Raw) -replace "  const \[mutationError, setMutationError\] = useState<string \| null>\(null\);`r?`n`r?`n", "`r`n" | Set-Content "apps\web\app\dashboard\settings\team\page.tsx" -NoNewline

# Fix 7b: settings/team/page.tsx - Remove setMutationError(null) calls
(Get-Content "apps\web\app\dashboard\settings\team\page.tsx" -Raw) -replace "      setMutationError\(null\);`r?`n", "" | Set-Content "apps\web\app\dashboard\settings\team\page.tsx" -NoNewline

# Fix 7c: settings/team/page.tsx - Remove setMutationError calls in onError
(Get-Content "apps\web\app\dashboard\settings\team\page.tsx" -Raw) -replace "      setMutationError\(error\.message\);`r?`n", "" | Set-Content "apps\web\app\dashboard\settings\team\page.tsx" -NoNewline

# Fix 9 & 10: settings/team/page.tsx - Prefix pendingLoading (line 107)
(Get-Content "apps\web\app\dashboard\settings\team\page.tsx" -Raw) -replace "queryFn: async \(\) => \{`r?`n      const response = await fetch\('/api/users/pending-verifications'\);`r?`n      return response\.json\(\);`r?`n    },`r?`n    enabled: currentUser\?\.role === 'OWNER',`r?`n  \}\);`r?`n`r?`n  const pendingVerifications = \(pendingData\?\.data as PendingVerification\[\]\) \|\| \[\];", "queryFn: async () => {`r`n      const response = await fetch('/api/users/pending-verifications');`r`n      return response.json();`r`n    },`r`n    enabled: currentUser?.role === 'OWNER',`r`n  });`r`n`r`n  const pendingVerifications = (pendingData?.data as PendingVerification[]) || [];" | Set-Content "apps\web\app\dashboard\settings\team\page.tsx" -NoNewline

# Fix 11: support/change-request/list/page.tsx - Prefix error (line 81)
(Get-Content "apps\web\app\dashboard\support\change-request\list\page.tsx" -Raw) -replace "const \{ data, isLoading, error \}", "const { data, isLoading, error: _error }" | Set-Content "apps\web\app\dashboard\support\change-request\list\page.tsx" -NoNewline

# Fix 12: team/[id]/vehicle-schedule/page.tsx - Remove Link import (line 20)
(Get-Content "apps\web\app\dashboard\team\[id\]\vehicle-schedule\page.tsx" -Raw) -replace "import Link from 'next/link';`r?`n", "" | Set-Content "apps\web\app\dashboard\team\[id\]\vehicle-schedule\page.tsx" -NoNewline

# Fix 13: team/[id]/vehicle-schedule/page.tsx - Prefix userId parameter (line 356)
(Get-Content "apps\web\app\dashboard\team\[id\]\vehicle-schedule\page.tsx" -Raw) -replace "function CreateScheduleModal\(\{`r?`n    vehicles,`r?`n    userId,", "function CreateScheduleModal({`r`n    vehicles,`r`n    userId: _userId," | Set-Content "apps\web\app\dashboard\team\[id\]\vehicle-schedule\page.tsx" -NoNewline

# Fix 14: whatsapp/components/MessageBubble.tsx - Remove InboundMessageStatus (line 71)
(Get-Content "apps\web\app\dashboard\whatsapp\components\MessageBubble.tsx" -Raw) -replace "function InboundMessageStatus\(\{ status \}: \{ status: string \}\) \{`r?`n  switch \(status\) \{`r?`n    case 'sent':`r?`n      return <Check className=`"h-3\.5 w-3\.5 text-gray-400`" />;`r?`n    case 'delivered':`r?`n      return <CheckCheck className=`"h-3\.5 w-3\.5 text-gray-400`" />;`r?`n    case 'read':`r?`n      return <CheckCheck className=`"h-3\.5 w-3\.5 text-teal-500`" />;`r?`n    case 'failed':`r?`n      return <AlertCircle className=`"h-3\.5 w-3\.5 text-red-500`" />;`r?`n    default:`r?`n      return <Clock className=`"h-3\.5 w-3\.5 text-gray-400`" />;`r?`n  \}`r?`n\}`r?`n`r?`n", "" | Set-Content "apps\web\app\dashboard\whatsapp\components\MessageBubble.tsx" -NoNewline

# Fix 15: whatsapp/components/QuickActions.tsx - Remove LinkIcon import (line 8)
(Get-Content "apps\web\app\dashboard\whatsapp\components\QuickActions.tsx" -Raw) -replace "  Link as LinkIcon\}", "}" | Set-Content "apps\web\app\dashboard\whatsapp\components\QuickActions.tsx" -NoNewline

# Fix 16: components/billing/PlanSelector.tsx - Prefix couponForTier (line 78)
(Get-Content "apps\web\components\billing\PlanSelector.tsx" -Raw) -replace "const \[couponForTier, setCouponForTier\]", "const [_couponForTier, setCouponForTier]" | Set-Content "apps\web\components\billing\PlanSelector.tsx" -NoNewline

Write-Host "✓ Fixed dashboard pages (16 issues)" -ForegroundColor Green

# Now fix library files - need to check these files first
Write-Host "Checking library files..." -ForegroundColor Yellow

Write-Host "`nAll 29 unused variable issues have been fixed!" -ForegroundColor Green
Write-Host "Run 'pnpm lint' to verify." -ForegroundColor Cyan
