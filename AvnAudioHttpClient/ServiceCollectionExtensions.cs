using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace AvnAudioHttpClient;

/// <summary>Extension for <see cref="IServiceCollection"/> to provide a <see cref="AvnHttpClient"/>
/// </summary>
public static class ServiceCollectionExtensions
{
    /// <summary>Registers a <see cref="AvnHttpClient"/>
    /// </summary>    
    public static IHttpClientBuilder AddAvnHttpClient(this IServiceCollection services, Action<AvnHttpClientOptions> optionsBuilder)
    {
        var _optionsBuilder = new AvnHttpClientOptions();
        optionsBuilder.Invoke(_optionsBuilder);

        var builder = services.AddHttpClient<AvnHttpClient>(nameof(AvnHttpClient), client =>
        {
            client.BaseAddress = new Uri(_optionsBuilder.Url);
        });
            
        services.AddScoped(sp => sp.GetRequiredService<AvnHttpClient>().Client);

        return builder;
    }
}
