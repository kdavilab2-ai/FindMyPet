param(
    [Parameter(Mandatory)]
    [ValidateSet('Instalar', 'Iniciar', 'Detener', 'Demostracion')]
    [string] $Accion
)

$ErrorActionPreference = 'Stop'
$raiz = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$instalador = Join-Path $PSScriptRoot 'instalar.cjs'
$servidores = Join-Path $PSScriptRoot 'servidores.cjs'
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$bloqueoInstalacion = $null
$instalando = $false

function Instalar-Dependencias($carpeta) {
    Push-Location -LiteralPath (Join-Path $raiz $carpeta)
    try {
        if (Test-Path -LiteralPath 'node_modules/.package-lock.json') {
            & $npm ls --depth=0 --silent 2>$null | Out-Null
            if ($LASTEXITCODE -eq 0) { return }
        }
        Write-Host "Instalando dependencias de $carpeta..."
        & $npm ci --include=dev --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) { throw "No se pudieron instalar las dependencias de $carpeta. Comprueba tu conexión y vuelve a ejecutar el instalador." }
    } finally {
        Pop-Location
    }
}

function Mostrar-PostgreSQL {
    try { $servicios = @(Get-Service -Name '*postgres*' -ErrorAction SilentlyContinue) } catch { $servicios = @() }
    if ($servicios.Count -gt 0) {
        Write-Host 'Servicios PostgreSQL detectados:'
        $servicios | Format-Table -Property Name,Status -AutoSize | Out-Host
        Write-Host 'Si el servicio está detenido, inícialo en la aplicación Servicios de Windows y vuelve a ejecutar el instalador.'
    } else {
        Write-Host 'Si PostgreSQL está instalado en modo portátil, inicia esa instancia y comprueba su puerto. En otro caso, instala PostgreSQL y conserva la contraseña que elijas.'
    }
}

function Ejecutar-Instalador($datos, [securestring] $clave) {
    if (!$datos) {
        & $node $instalador | Out-Host
        return $LASTEXITCODE
    }
    $memoria = [IntPtr]::Zero
    try {
        if ($clave) {
            $memoria = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($clave)
            $datos.password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($memoria)
        }
        $datos | ConvertTo-Json -Compress | & $node $instalador --credenciales | Out-Host
        return $LASTEXITCODE
    } finally {
        $datos.Remove('password') | Out-Null
        if ($memoria -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($memoria) }
    }
}

try {
    Set-Location -LiteralPath $raiz
    $node = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
    if (!$node) { throw 'Falta Node.js. Instala Node.js LTS y abre de nuevo este archivo.' }
    if ($Accion -eq 'Instalar') {
        $sha = [System.Security.Cryptography.SHA256]::Create()
        try { $id = [BitConverter]::ToString($sha.ComputeHash($OutputEncoding.GetBytes($raiz.ToLowerInvariant()))).Replace('-', '') }
        finally { $sha.Dispose() }
        $bloqueoInstalacion = [System.Threading.Mutex]::new($false, "Local\FindMyPet-Instalar-$id")
        try { $instalando = $bloqueoInstalacion.WaitOne(0) }
        catch [System.Threading.AbandonedMutexException] { $instalando = $true }
        if (!$instalando) { throw 'Ya hay una instalación de FindMyPet en curso. Espera a que termine.' }

        $version = [version]((& $node --version).TrimStart('v'))
        if (!(($version.Major -eq 20 -and $version.Minor -ge 19) -or $version -ge [version]'22.12')) {
            throw 'Instala Node.js LTS 22.12 o posterior y vuelve a ejecutar el instalador.'
        }
        $npm = (Get-Command npm.cmd -ErrorAction SilentlyContinue).Source
        if (!$npm) { throw 'Falta npm. Reinstala Node.js con su instalador oficial.' }
        Instalar-Dependencias 'server'
        Instalar-Dependencias 'client'
        $codigo = Ejecutar-Instalador $null $null
        if ($codigo -eq 10) {
            Write-Host 'Indica los datos de tu PostgreSQL local. Pulsa Enter para aceptar el valor entre corchetes.'
            $servidor = Read-Host 'Servidor [localhost]'
            $puerto = Read-Host 'Puerto [5432]'
            $usuario = Read-Host 'Usuario de PostgreSQL [postgres]'
            $datos = @{
                host = if ($servidor) { $servidor.Trim() } else { 'localhost' }
                port = if ($puerto) { $puerto.Trim() } else { '5432' }
                user = if ($usuario) { $usuario.Trim() } else { 'postgres' }
            }
            $codigo = Ejecutar-Instalador $datos $null
            if ($codigo -eq 11) {
                $clave = Read-Host "Contraseña de PostgreSQL para $($datos.user) (no se mostrará)" -AsSecureString
                try { $codigo = Ejecutar-Instalador $datos $clave } finally { $clave.Dispose() }
            }
        }
        if ($codigo -eq 12) { Mostrar-PostgreSQL }
        if ($codigo -ne 0) { exit 1 }
        Write-Host 'Instalación lista. Abre Iniciar FindMyPet.bat para usar la aplicación.'
    } elseif ($Accion -eq 'Demostracion') {
        & $node $servidores iniciar demo
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
        Start-Process 'http://localhost:5174'
    } else {
        $operacion = if ($Accion -eq 'Iniciar') { 'iniciar' } else { 'detener' }
        & $node $servidores $operacion
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
        if ($Accion -eq 'Detener') { & $node $servidores detener demo; exit $LASTEXITCODE }
        if ($Accion -eq 'Iniciar') { Start-Process 'http://localhost:5173' }
    }
} catch {
    Write-Host ("FindMyPet: " + $_.Exception.Message) -ForegroundColor Red
    exit 1
} finally {
    if ($instalando) { $bloqueoInstalacion.ReleaseMutex() }
    if ($bloqueoInstalacion) { $bloqueoInstalacion.Dispose() }
}
