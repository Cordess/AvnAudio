global using AvnAudio;
using AvnAudioSignalRDemo.Client;
using AvnAudioHttpClient;
using Microsoft.AspNetCore.Components.Web;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;
using Microsoft.AspNetCore.Components.WebAssembly.Authentication;

var builder = WebAssemblyHostBuilder.CreateDefault(args);
builder.RootComponents.Add<App>("#app");
builder.RootComponents.Add<HeadOutlet>("head::after");

// Load local configuration for sensitive data (not committed to source control)
var http = new HttpClient { BaseAddress = new Uri(builder.HostEnvironment.BaseAddress) };
try
{
    using var response = await http.GetAsync("appsettings.Local.json");
    if (response.IsSuccessStatusCode)
    {
        using var stream = await response.Content.ReadAsStreamAsync();
        builder.Configuration.AddJsonStream(stream);
    }
}
catch
{
    // appsettings.Local.json is optional in production
}

builder.Services.AddAvnHttpClient(options => options.Url = builder.HostEnvironment.BaseAddress)
    .AddHttpMessageHandler<BaseAddressAuthorizationMessageHandler>();

// Supply HttpClient instances that include access tokens when making requests to the server project
builder.Services.AddScoped(sp => sp.GetRequiredService<IHttpClientFactory>().CreateClient("ServerAPI"));

// Required to use AvnAudio
builder.Services.AddScoped<AvnAudioInterop>();

// CRITICAL: Add Authorization Core
builder.Services.AddAuthorizationCore(options =>
{
    options.FallbackPolicy = null;  // <-- Dies ist entscheidend!
});

// REQUIRED: MSAL Authentication
builder.Services.AddMsalAuthentication(options =>
{
    builder.Configuration.Bind("AzureAd", options.ProviderOptions.Authentication); 
    var appId = builder.Configuration.GetValue<string>("AzureAd:ClientId");
    options.ProviderOptions.DefaultAccessTokenScopes.Add($"api://{appId}/user_impersonation");
});

await builder.Build().RunAsync();
