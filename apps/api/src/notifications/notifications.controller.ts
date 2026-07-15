import { Controller, Get, Patch, Param, Query, UseGuards, Request } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

import { NotificationsService } from './notifications.service';

import { JwtAuthGuard } from '../auth/guards/auth.guard';



@ApiTags('Notifications')

@Controller('notifications')

@SkipThrottle()

@UseGuards(JwtAuthGuard)

@ApiBearerAuth()

export class NotificationsController {

  constructor(private notifications: NotificationsService) {}



  @Get('unread-count')

  @ApiOperation({ summary: 'O\'qilmagan bildirishnomalar soni' })

  unreadCount(@Request() req: { user: { id: string } }) {

    return this.notifications.getUnreadCount(req.user.id);

  }



  @Patch('read-all')

  @ApiOperation({ summary: 'Barcha bildirishnomalarni o\'qilgan deb belgilash' })

  markAllRead(@Request() req: { user: { id: string } }) {

    return this.notifications.markAllRead(req.user.id);

  }



  @Get()

  @ApiOperation({ summary: 'Foydalanuvchi bildirishnomalari' })

  list(

    @Request() req: { user: { id: string } },

    @Query('unreadOnly') unreadOnly?: string,

  ) {

    return this.notifications.getUserNotifications(req.user.id, unreadOnly === 'true');

  }



  @Patch(':id/read')

  @ApiOperation({ summary: 'Bildirishnomani o\'qilgan deb belgilash' })

  markRead(@Param('id') id: string, @Request() req: { user: { id: string } }) {

    return this.notifications.markRead(req.user.id, id);

  }

}

