try {
    Write-Host "📱 Testing Android random image endpoint..."
    
    $uri = "http://localhost:3001/api/android/gallery/Star%20Warss/random-image"
    Write-Host "🔗 URL: $uri"
    
    $response = Invoke-WebRequest -Uri $uri -Method GET -ContentType "application/json" -ErrorAction Stop
    
    Write-Host "✅ Status Code: $($response.StatusCode)"
    Write-Host "📄 Response Content:"
    Write-Host $response.Content
    
} catch {
    Write-Host "❌ Error occurred:"
    Write-Host "Status Code: $($_.Exception.Response.StatusCode.value__)"
    Write-Host "Error Message: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response Body: $responseBody"
    }
}
