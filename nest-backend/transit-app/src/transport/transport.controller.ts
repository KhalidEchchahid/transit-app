import {
  Controller,
  Get,
  Param,
  Query,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { LineRepository } from './repositories/line.repository';
import { RaptorService } from './routing/raptor.service';
import { LineDetails, StopDetails } from './models/transport.models';

@Controller('api/v1')
export class TransportController {
  private readonly logger = new Logger(TransportController.name);

  constructor(
    private readonly lineRepo: LineRepository,
    private readonly raptor: RaptorService,
  ) {}

  // GET /api/v1/lines
  @Get('lines')
  async getAllLines() {
    return this.lineRepo.getAllLines();
  }

  // GET /api/v1/lines/:id
  @Get('lines/:id')
  async getLineDetails(@Param('id') id: string): Promise<LineDetails> {
    const lineId = parseInt(id, 10);
    if (isNaN(lineId)) {
      throw new BadRequestException('Invalid line ID');
    }

    const line = await this.lineRepo.getLineById(lineId);
    if (!line) {
      throw new NotFoundException('Line not found');
    }

    const stops = await this.lineRepo.getStopsForLine(lineId);
    return { line, stops };
  }

  // GET /api/v1/stops?min_lat=&min_lon=&max_lat=&max_lon=
  @Get('stops')
  async getStops(
    @Query('min_lat') minLatStr: string,
    @Query('min_lon') minLonStr: string,
    @Query('max_lat') maxLatStr: string,
    @Query('max_lon') maxLonStr: string,
  ) {
    const minLat = parseFloat(minLatStr);
    const minLon = parseFloat(minLonStr);
    const maxLat = parseFloat(maxLatStr);
    const maxLon = parseFloat(maxLonStr);

    if (!minLat || !maxLat) {
      throw new BadRequestException('Missing viewport coordinates');
    }

    return this.lineRepo.getStopsInViewport(minLat, minLon, maxLat, maxLon);
  }

  // GET /api/v1/stops/:id
  @Get('stops/:id')
  async getStopDetails(@Param('id') id: string): Promise<StopDetails> {
    const stopId = parseInt(id, 10);
    if (isNaN(stopId)) {
      throw new BadRequestException('Invalid stop ID');
    }

    const stop = await this.lineRepo.getStopById(stopId);
    if (!stop) {
      throw new NotFoundException('Stop not found');
    }

    const lines = await this.lineRepo.getLinesForStop(stopId);
    return { stop, lines };
  }

  // GET /api/v1/route?from_lat=&from_lon=&to_lat=&to_lon=&time=&day=
  @Get('route')
  async getRoute(
    @Query('from_lat') fromLatStr: string,
    @Query('from_lon') fromLonStr: string,
    @Query('to_lat') toLatStr: string,
    @Query('to_lon') toLonStr: string,
    @Query('time') timeStr?: string,
    @Query('day') dayParam?: string,
  ) {
    const fromLat = parseFloat(fromLatStr);
    const fromLon = parseFloat(fromLonStr);
    const toLat = parseFloat(toLatStr);
    const toLon = parseFloat(toLonStr);

    if (!fromLat || !toLat) {
      throw new BadRequestException('Missing source/destination coordinates');
    }

    // Parse time (seconds from midnight), default 08:30
    let departureTime = 8 * 3600 + 30 * 60;
    if (timeStr) {
      const parsed = parseInt(timeStr, 10);
      if (!isNaN(parsed) && parsed >= 0 && parsed < 86400) {
        departureTime = parsed;
      }
    }

    // Parse day type
    let dayType = 'weekday';
    if (dayParam) {
      const d = dayParam.toLowerCase();
      if (d === 'weekend') {
        dayType = 'weekend';
      } else if (d === 'saturday' || d === 'sunday') {
        dayType = d;
      }
    }

    // Find nearby stops (within ~1km using 0.01 degrees)
    const sources = await this.lineRepo.getStopsInViewport(
      fromLat - 0.01,
      fromLon - 0.01,
      fromLat + 0.01,
      fromLon + 0.01,
    );

    const targets = await this.lineRepo.getStopsInViewport(
      toLat - 0.01,
      toLon - 0.01,
      toLat + 0.01,
      toLon + 0.01,
    );

    this.logger.log(
      `GetRoute: Found ${sources.length} source stops, ${targets.length} target stops, time=${departureTime}, day=${dayType}`,
    );

    const sourceMap = this.raptor.convertStopsToIds(sources, 0);
    const targetSet = new Set(
      targets
        .map((s) => this.raptor.convertStopsToIds([s], 0))
        .flatMap((m) => [...m.keys()]),
    );

    if (sourceMap.size === 0 || targetSet.size === 0) {
      throw new NotFoundException('No nearby stops found');
    }

    // Try one or more service patterns
    const dayOptions =
      dayType === 'weekend' ? ['saturday', 'sunday'] : [dayType];

    for (const d of dayOptions) {
      const journey = this.raptor.findRoute(
        sourceMap,
        targetSet,
        departureTime,
        d,
      );
      if (journey) {
        return journey;
      }
    }

    throw new NotFoundException('No route found');
  }
}
