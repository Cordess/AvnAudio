namespace AvnAudioHttpClient;

/// <summary> <see cref="HttpClient"/>
/// </summary>
public class AvnHttpClient
{
    /// <summary>Returns the <see cref="HttpClient"/>    
    /// </summary>
    public HttpClient Client { get; }

    /// <summary>Initializes a new <see cref="AvnHttpClient"/> instance.   
    /// </summary>   
    public AvnHttpClient(HttpClient httpClient)
    {
        Client = httpClient;
    }
}
