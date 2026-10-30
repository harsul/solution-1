using AspireApp1.Server.Endpoints;

namespace AspireApp1.Server.xUnit;

public class WeatherForecastTests
{
    [Theory]
    [InlineData(0, 32)]
    [InlineData(37, 98)]
    public void TemperatureF_is_converted_from_Celsius(int celsius, int expectedFahrenheit)
    {
        var forecast = new WeatherForecast(new DateOnly(2026, 1, 1), celsius, "Mild");

        Assert.Equal(expectedFahrenheit, forecast.TemperatureF);
    }
}
