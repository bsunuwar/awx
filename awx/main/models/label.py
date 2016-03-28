# Copyright (c) 2016 Ansible, Inc.
# All Rights Reserved.

# Django
from django.db import models
from django.core.urlresolvers import reverse
from django.utils.translation import ugettext_lazy as _

# AWX
from awx.main.models.base import CommonModelNameNotUnique

__all__ = ('Label', )

class Label(CommonModelNameNotUnique):
    '''
    Generic Tag. Designed for tagging Job Templates, but expandable to other models.
    '''

    class Meta:
        app_label = 'main'
        unique_together = (("name", "organization"),)
        ordering = ('organization', 'name')

    organization = models.ForeignKey(
        'Organization',
        related_name='labels',
        help_text=_('Organization this label belongs to.'),
        on_delete=models.CASCADE,
    )

    def get_absolute_url(self):
        return reverse('api:label_detail', args=(self.pk,))

