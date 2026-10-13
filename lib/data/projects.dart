import 'package:flutter/material.dart';

/// مشروع تبرع (بيانات تجريبية محلية — لاحقاً تُستبدل بـ API).
class DonationProject {
  const DonationProject({
    required this.id,
    required this.titleAr,
    required this.titleEn,
    required this.descAr,
    required this.descEn,
    required this.icon,
    required this.color,
  });

  final String id;
  final String titleAr;
  final String titleEn;
  final String descAr;
  final String descEn;
  final IconData icon;
  final Color color;

  String title(bool ar) => ar ? titleAr : titleEn;
  String desc(bool ar) => ar ? descAr : descEn;
}

const kProjects = <DonationProject>[
  DonationProject(
    id: 'water',
    titleAr: 'سقيا الماء',
    titleEn: 'Water Wells',
    descAr: 'حفر الآبار وتوفير مياه نظيفة للمحتاجين.',
    descEn: 'Dig wells and provide clean water to those in need.',
    icon: Icons.water_drop,
    color: Color(0xFF1E88E5),
  ),
  DonationProject(
    id: 'food',
    titleAr: 'إطعام الطعام',
    titleEn: 'Food Baskets',
    descAr: 'سلال غذائية للأسر المستحقة.',
    descEn: 'Food baskets for eligible families.',
    icon: Icons.restaurant,
    color: Color(0xFFF57C00),
  ),
  DonationProject(
    id: 'education',
    titleAr: 'كفالة طالب علم',
    titleEn: 'Student Sponsorship',
    descAr: 'دعم التعليم للطلاب المحتاجين.',
    descEn: 'Support education for students in need.',
    icon: Icons.school,
    color: Color(0xFF6A1B9A),
  ),
  DonationProject(
    id: 'health',
    titleAr: 'العلاج والصحة',
    titleEn: 'Healthcare',
    descAr: 'المساهمة في علاج المرضى غير القادرين.',
    descEn: 'Contribute to treating patients who cannot afford care.',
    icon: Icons.medical_services,
    color: Color(0xFFD32F2F),
  ),
];

const kQuickAmounts = <int>[10, 50, 100, 500];
