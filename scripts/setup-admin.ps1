$ErrorActionPreference = 'Stop'
$adminPasswordPointer = [IntPtr]::Zero
try {
  $adminDisplayName = Read-Host 'Admin name [admin]'
  if ([string]::IsNullOrWhiteSpace($adminDisplayName)) { $adminDisplayName = 'admin' }
  $env:ADMIN_NAME = $adminDisplayName
  $env:ADMIN_EMAIL = Read-Host 'Admin email address'
  $adminSecurePassword = Read-Host 'Password (8-128 characters)' -AsSecureString
  $adminPasswordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($adminSecurePassword)
  $env:ADMIN_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($adminPasswordPointer)
  node scripts/create-admin.js
  $adminSetupExitCode = $LASTEXITCODE
} finally {
  if ($adminPasswordPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($adminPasswordPointer) }
  Remove-Item Env:ADMIN_PASSWORD,Env:ADMIN_EMAIL,Env:ADMIN_NAME -ErrorAction SilentlyContinue
}
exit $adminSetupExitCode
